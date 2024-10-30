import fs from 'fs';
import fetch from 'node-fetch';

const blacklist = ['Write-ins'];

let states = JSON.parse(fs.readFileSync('states.json', 'utf8'));

const convertToCst = (time) => {
    const date = new Date(time);
    return date.toLocaleString('en-US', { timeZone: 'America/Chicago' });
};

setInterval(async () => {
    fs.writeFileSync('states.json', JSON.stringify(states, null, 2));
    //console.log('States data saved to states.json');
}, 5000);

const fetchElectoralData = async () => {
    const response = await fetch(`https://assets-cdn.abcnews.com/elections/national/2024/general/v1/maps/electoral.json`);
    const data = await response.json();
    return data;
}

const fetchSenateData = async () => {
    const response = await fetch(`https://assets-cdn.abcnews.com/elections/national/2024/general/v1/maps/senate.json`);
    const data = await response.json();
    return data;
}

const fetchHouseData = async () => {
    const response = await fetch(`https://assets-cdn.abcnews.com/elections/national/2024/general/v1/maps/house.json`);
    const data = await response.json();
    return data;
}

async function generalElectionUpdate() {
    const currentStatesData = await fetchElectoralData();
    for (let q = 0; q < currentStatesData.states.length; q++) {
        //console.log('Current state (General):', currentStatesData.states[q].abbreviation);
        const currentStateData = currentStatesData.states[q];
        const ogCurrentStateData = states[`${currentStateData.abbreviation}`];
        let candidates = {};
        for (let r = 0; r < currentStateData.candidates.length; r++) {
            if (!candidates[`${currentStateData.candidates[r].party}`]) {
                candidates[`${currentStateData.candidates[r].party}`] = {
                    id: currentStateData.candidates[r].id,
                    name: currentStateData.candidates[r].displayName,
                    shortName: currentStateData.candidates[r].shortDisplayName,
                    party: currentStateData.candidates[r].party,
                    stats: {
                        votes: currentStateData.candidates[r].statistics.votes.doubleValue,
                        percent: currentStateData.candidates[r].statistics.percent.displayValue,
                        electoralVotes: currentStateData.candidates[r].statistics.electoralVotes.doubleValue
                    }
                };
            }
        }
        let lastUpdateData = states[`${currentStateData.abbreviation}`].generalElectionCandidates;
        if (!lastUpdateData) {
            lastUpdateData = {};
        }
        let updated = false;
        let sortedCandidates = Object.values(candidates).sort((a, b) => b.stats.votes - a.stats.votes).slice(0, 3);
        for (let candidate of sortedCandidates) {
            if (lastUpdateData[candidate.party]) {
                if ((candidate.winner && !previousCandidate?.winner && !updated)) {
                    updated = true;
                    let msg = `✅ ${states[currentStateData.abbreviation].name.toUpperCase()} PROJECTED WINNER: ${candidate.name} (${candidate.party[0].toUpperCase()})` + '\n';
                    msg += `\nVotes Received: ${candidate.stats.votes.toLocaleString()}`;
                    let secondPlaceCandidate = sortedCandidates[1];
                    if (secondPlaceCandidate) {
                        msg += `\n\nRunner Up: ${secondPlaceCandidate.name} (${secondPlaceCandidate.party[0].toUpperCase()}) - ${secondPlaceCandidate.stats.votes.toLocaleString()} votes (${(candidate.stats.votes - secondPlaceCandidate.stats.votes).toLocaleString()} votes behind)`;
                    } else {
                        msg += `\nNo second place candidate`;
                    }
                    msg += `\n\n${states[currentStateData.abbreviation].name.toUpperCase()} Electoral Votes: ${candidate.stats.electoralVotes.toLocaleString()}`;
                    sendMSG(msg);
                } else {
                    if (!updated && (lastUpdateData[candidate.party].stats.votes !== candidate.stats.votes)) {
                        let msg = `${states[currentStateData.abbreviation].name.toUpperCase()} [${states[currentStateData.abbreviation].availableElectoralVotes}] GENERAL ELECTION UPDATE:\n`;
                        for (let topCandidate of sortedCandidates) {
                            if (!blacklist.includes(topCandidate.name)) {
                                msg += `[${topCandidate.stats.percent}] (${topCandidate.party[0].toUpperCase()}) ${topCandidate.name} - ${topCandidate.stats.votes.toLocaleString()} votes (+${(topCandidate.stats.votes - (lastUpdateData[topCandidate.party] ? lastUpdateData[topCandidate.party].stats.votes : 0)).toLocaleString()})` + '\n';
                            }
                        }
                        try {
                            let pollsClosed = currentStateData.pollClosingDate.value;
                            if (new Date(pollsClosed) < new Date()) {
                                msg += `\nPolls closed at ${convertToCst(pollsClosed).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`;
                            } else {
                                msg += `\nPolls close at ${convertToCst(pollsClosed).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`;
                            }
                            msg += `\nPrevious Update: ${convertToCst(ogCurrentStateData.lastUpdated).toString().split(', ')[1]} (CST)`;
                        } catch (error) { }
                        updated = true;
                        sendMSG(msg)
                    }
                }
            }
        }
        states[currentStateData.abbreviation].generalElectionCandidates = candidates;
        states[currentStateData.abbreviation].lastUpdated = new Date().toISOString();
        states[currentStateData.abbreviation].availableElectoralVotes = currentStateData.availableElectoralVotes;
    }
};

async function houseElectionUpdate() {
    const currentHouseData = await fetchHouseData();
    for (let q = 0; q < currentHouseData.states.length; q++) {
        //console.log(`Current state (House): ${currentHouseData.states[q].abbreviation}`);
        const currentStateData = currentHouseData.states[q];
        const ogCurrentStateData = states[`${currentStateData.abbreviation}`];
        let candidates = {};
        if (currentStateData.congressionalDistricts) {
            for (let e = 0; e < currentStateData.congressionalDistricts.length; e++) {
                //console.log(`Current district: ${currentStateData.congressionalDistricts[e].displayName} (${currentStateData.displayName})`);
                const currentDistrictData = currentStateData.congressionalDistricts[e];
                for (let r = 0; r < currentDistrictData.candidates.length; r++) {
                    if (!candidates[`${currentDistrictData.candidates[r].party}`]) {
                        candidates[`${currentDistrictData.candidates[r].party}`] = {
                            id: currentDistrictData.candidates[r].id,
                            name: currentDistrictData.candidates[r].displayName,
                            shortName: currentDistrictData.candidates[r].shortDisplayName,
                            party: currentDistrictData.candidates[r].party,
                            stats: {
                                votes: currentDistrictData.candidates[r].statistics.votes.doubleValue,
                                percent: currentDistrictData.candidates[r].statistics.percent.displayValue
                            }
                        };
                    }
                }

                let lastUpdateData = states[`${currentStateData.abbreviation}`].houseElectionCandidates;
                if (!lastUpdateData) {
                    lastUpdateData = {};
                }
                let updated = false;
                let sortedCandidates = Object.values(candidates).sort((a, b) => b.stats.votes - a.stats.votes).slice(0, 3);

                for (let candidate of sortedCandidates) {
                    if (lastUpdateData[candidate.party]) {
                        if ((candidate.winner && !previousCandidate?.winner && !updated)) {
                            updated = true;
                            let msg = `✅ ${states[currentStateData.abbreviation].name.toUpperCase()} PROJECTED WINNER: ${candidate.name} (${candidate.party[0].toUpperCase()})` + '\n';
                            msg += `\nVotes Received: ${candidate.stats.votes.toLocaleString()}`;
                            let secondPlaceCandidate = sortedCandidates[1];
                            if (secondPlaceCandidate) {
                                msg += `\n\nRunner Up: ${secondPlaceCandidate.name} (${secondPlaceCandidate.party[0].toUpperCase()}) - ${secondPlaceCandidate.stats.votes.toLocaleString()} votes (${(candidate.stats.votes - secondPlaceCandidate.stats.votes).toLocaleString()} votes behind)`;
                            } else {
                                msg += `\nNo second place candidate`;
                            }
                            sendMSG(msg);
                        } else {
                            if (!updated && (lastUpdateData[candidate.party].stats.votes !== candidate.stats.votes)) {
                                let msg = `${states[currentStateData.abbreviation].name.toUpperCase()} [HOUSE] UPDATE:\n`;
                                for (let topCandidate of sortedCandidates) {
                                    if (!blacklist.includes(topCandidate.name)) {
                                        msg += `[${topCandidate.stats.percent}] (${topCandidate.party[0].toUpperCase()}) ${topCandidate.name} - ${topCandidate.stats.votes.toLocaleString()} votes (+${(topCandidate.stats.votes - (lastUpdateData[topCandidate.party] ? lastUpdateData[topCandidate.party].stats.votes : 0)).toLocaleString()})` + '\n';
                                    }
                                }
                                try {
                                    let pollsClosed = currentStateData.pollClosingDate.value;
                                    if (new Date(pollsClosed) < new Date()) {
                                        msg += `\nPolls closed at ${convertToCst(pollsClosed).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`;
                                    } else {
                                        msg += `\nPolls close at ${convertToCst(pollsClosed).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`;
                                    }
                                    msg += `\nPrevious Update: ${convertToCst(ogCurrentStateData.lastUpdated).toString().split(', ')[1]} (CST)`;
                                } catch (error) { }
                                updated = true;
                                sendMSG(msg);
                            }
                        }
                    }
                }
            }
        }
        states[currentStateData.abbreviation].houseElectionCandidates = candidates;
        states[currentStateData.abbreviation].lastUpdated = new Date().toISOString();
    }
}

async function senateElectionUpdate() {
    const currentSenateData = await fetchSenateData();
    for (let q = 0; q < currentSenateData.states.length; q++) {
        //console.log(`Current state (Senate): ${currentSenateData.states[q].abbreviation}`);
        const currentStateData = currentSenateData.states[q];
        const ogCurrentStateData = states[`${currentStateData.abbreviation}`];
        let candidates = {};
        if (currentStateData.candidates) {
            for (let r = 0; r < currentStateData.candidates.length; r++) {
                if (!candidates[`${currentStateData.candidates[r].party}`]) {
                    candidates[`${currentStateData.candidates[r].party}`] = {
                        id: currentStateData.candidates[r].id,
                        name: currentStateData.candidates[r].displayName,
                        shortName: currentStateData.candidates[r].shortDisplayName,
                        party: currentStateData.candidates[r].party,
                        stats: {
                            votes: currentStateData.candidates[r].statistics.votes.doubleValue,
                            percent: currentStateData.candidates[r].statistics.percent.displayValue
                        }
                    };
                }
            }
            let lastUpdateData = states[`${currentStateData.abbreviation}`].senateElectionCandidates;
            if (!lastUpdateData) {
                lastUpdateData = {};
            }
            let updated = false;
            let sortedCandidates = Object.values(candidates).sort((a, b) => b.stats.votes - a.stats.votes).slice(0, 3);
            for (let candidate of sortedCandidates) {
                if (lastUpdateData[candidate.party]) {
                    if ((candidate.winner && !previousCandidate?.winner && !updated)) {
                        updated = true;
                        let msg = `✅ ${states[currentStateData.abbreviation].name.toUpperCase()} PROJECTED WINNER: ${candidate.name} (${candidate.party[0].toUpperCase()})` + '\n';
                        msg += `\nVotes Received: ${candidate.stats.votes.toLocaleString()}`;
                        let secondPlaceCandidate = sortedCandidates[1];
                        if (secondPlaceCandidate) {
                            msg += `\n\nRunner Up: ${secondPlaceCandidate.name} (${secondPlaceCandidate.party[0].toUpperCase()}) - ${secondPlaceCandidate.stats.votes.toLocaleString()} votes (${(candidate.stats.votes - secondPlaceCandidate.stats.votes).toLocaleString()} votes behind)`;
                        } else {
                            msg += `\nNo second place candidate`;
                        }
                        sendMSG(msg);
                    } else {
                        if (!updated && (lastUpdateData[candidate.party].stats.votes !== candidate.stats.votes)) {
                            let msg = `${states[currentStateData.abbreviation].name.toUpperCase()} [SENATE] UPDATE:\n`;
                            for (let topCandidate of sortedCandidates) {
                                if (!blacklist.includes(topCandidate.name)) {
                                    msg += `[${topCandidate.stats.percent}] (${topCandidate.party[0].toUpperCase()}) ${topCandidate.name} - ${topCandidate.stats.votes.toLocaleString()} votes (+${(topCandidate.stats.votes - (lastUpdateData[topCandidate.party] ? lastUpdateData[topCandidate.party].stats.votes : 0)).toLocaleString()})` + '\n';
                                }
                            }
                            try {
                                let pollsClosed = currentStateData.pollClosingDate.value;
                                if (new Date(pollsClosed) < new Date()) {
                                    msg += `\nPolls closed at ${convertToCst(pollsClosed).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`;
                                } else {
                                    msg += `\nPolls close at ${convertToCst(pollsClosed).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`;
                                }
                                msg += `\nPrevious Update: ${convertToCst(ogCurrentStateData.lastUpdated).toString().split(', ')[1]} (CST)`;
                            } catch (error) { }
                            updated = true;
                            sendMSG(msg);
                        }
                    }
                }
            }
        }
        states[currentStateData.abbreviation].senateElectionCandidates = candidates;
        states[currentStateData.abbreviation].lastUpdated = new Date().toISOString();
    }
}

generalElectionUpdate();
senateElectionUpdate();
houseElectionUpdate();

setInterval(generalElectionUpdate, 60000);
setInterval(senateElectionUpdate, 60000);
setInterval(houseElectionUpdate, 60000);

function sendMSG(msg) {
    console.log(msg, msg.length);
}
