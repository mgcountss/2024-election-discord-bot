import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

if (!fs.existsSync('./backups')) {
    fs.mkdirSync('./backups');
}

setInterval(() => {
    fs.copyFileSync('states.json', `./backups/states_${new Date().toISOString().split('T')[0]}.json`);
}, 300000);

let states = JSON.parse(fs.readFileSync('states.json', 'utf8'));

const convertToCst = (time) => {
    let date = new Date(time).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    return date.split(':').slice(0, 2).join(':');
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
                    if (candidate.name === 'Write-ins') { candidate.name = 'Others'; }
                    let msg = {
                        "state": currentStateData.name,
                        "district": null,
                        "type": "GENERAL",
                        "msgType": "projection",
                        "availableElectoralVotes": ogCurrentStateData.availableElectoralVotes,
                        "main": `${candidate.name} (${candidate.party[0].toUpperCase()})`,
                        "winnerParty": candidate.party[0].toUpperCase(),
                        "submain": [{
                            "title": "Votes Received:",
                            "description": `${candidate.stats.votes.toLocaleString()} votes (${candidate.stats.percent})`
                        }, {
                            "title": "Runner Up: ",
                            "description": `${sortedCandidates[1]?.name || 'N/A'} (${sortedCandidates[1]?.party[0].toUpperCase() || 'N/A'}) - ${sortedCandidates[1]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[1]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[1]?.party]?.stats.votes || 0)} behind]`
                        }],
                        "footer": {
                            "text": `Polls closed at ${convertToCst(currentStateData.pollClosingDate.value).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`
                        }
                    }
                    sendMSG(msg, false, 'general');
                } else {
                    if ((!updated && (lastUpdateData[candidate.party].stats.votes !== candidate.stats.votes))) {
                        updated = true;
                        if (sortedCandidates[0]?.name === 'Write-ins') { sortedCandidates[0].name = 'Others'; }
                        if (sortedCandidates[1]?.name === 'Write-ins') { sortedCandidates[1].name = 'Others'; }
                        if (sortedCandidates[2]?.name === 'Write-ins') { sortedCandidates[2].name = 'Others'; }
                        let msg = {
                            "state": currentStateData.name,
                            "district": null,
                            "type": "GENERAL",
                            "msgType": "update",
                            "availableElectoralVotes": ogCurrentStateData.availableElectoralVotes,
                            "winnerParty": candidate.party[0].toUpperCase(),
                            "submain": [{
                                "title": `${sortedCandidates[0]?.name || 'N/A'} (${sortedCandidates[0]?.party[0].toUpperCase() || 'N/A'})`,
                                "description": `${sortedCandidates[0]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[0]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[0]?.party]?.stats.votes || 0)} behind]`
                            }, {
                                "title": `${sortedCandidates[1]?.name || 'N/A'} (${sortedCandidates[1]?.party[0].toUpperCase() || 'N/A'})`,
                                "description": `${sortedCandidates[1]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[1]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[1]?.party]?.stats.votes || 0)} behind]`
                            }, {
                                "title": `${sortedCandidates[2]?.name || 'N/A'} (${sortedCandidates[2]?.party[0].toUpperCase() || 'N/A'})`,
                                "description": `${sortedCandidates[2]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[2]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[2]?.party]?.stats.votes || 0)} behind]`
                            }],
                            "footer": {
                                "text": `Polls closed at ${convertToCst(currentStateData.pollClosingDate.value).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`
                            }
                        }
                        sendMSG(msg, false, 'general');
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
                            if (candidate.name === 'Write-ins') { candidate.name = 'Others'; }
                            updated = true;
                            let msg = {
                                "state": currentStateData.abbreviation,
                                "district": currentDistrictData.displayName,
                                "type": "HOUSE",
                                "msgType": "projection",
                                "main": `${candidate.name} (${candidate.party[0].toUpperCase()})`,
                                "winnerParty": candidate.party[0].toUpperCase(),
                                "submain": [{
                                    "title": "Votes Received:",
                                    "description": `${candidate.stats.votes.toLocaleString()} votes (${candidate.stats.percent})`
                                }, {
                                    "title": "Runner Up: ",
                                    "description": `${sortedCandidates[1]?.name || 'N/A'} (${sortedCandidates[1]?.party[0].toUpperCase() || 'N/A'}) - ${sortedCandidates[1]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[1]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[1]?.party]?.stats.votes || 0)} behind]`
                                }],
                                "footer": {
                                    "text": `Polls closed at ${convertToCst(currentStateData.pollClosingDate.value).toString().split(', ')[1]} (CST), ~${currentDistrictData.reporting.displayValue} votes in.`
                                }
                            }
                            sendMSG(msg, true, 'house');
                        } else {
                            if ((!updated && (lastUpdateData[candidate.party].stats.votes !== candidate.stats.votes))) {
                                updated = true;
                                if (sortedCandidates[0]?.name === 'Write-ins') { sortedCandidates[0].name = 'Others'; }
                                if (sortedCandidates[1]?.name === 'Write-ins') { sortedCandidates[1].name = 'Others'; }
                                if (sortedCandidates[2]?.name === 'Write-ins') { sortedCandidates[2].name = 'Others'; }
                                let msg = {
                                    "state": currentStateData.abbreviation,
                                    "district": currentDistrictData.displayName,
                                    "type": "HOUSE",
                                    "msgType": "update",
                                    "submain": [{
                                        "title": `${sortedCandidates[0]?.name || 'N/A'} (${sortedCandidates[0]?.party[0].toUpperCase() || 'N/A'})`,
                                        "description": `${sortedCandidates[0]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[0]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[0]?.party]?.stats.votes || 0)} behind]`
                                    }, {
                                        "title": `${sortedCandidates[1]?.name || 'N/A'} (${sortedCandidates[1]?.party[0].toUpperCase() || 'N/A'})`,
                                        "description": `${sortedCandidates[1]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[1]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[1]?.party]?.stats.votes || 0)} behind]`
                                    }, {
                                        "title": `${sortedCandidates[2]?.name || 'N/A'} (${sortedCandidates[2]?.party[0].toUpperCase() || 'N/A'})`,
                                        "description": `${sortedCandidates[2]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[2]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[2]?.party]?.stats.votes || 0)} behind]`
                                    }],
                                    "footer": {
                                        "text": `Polls closed at ${convertToCst(currentStateData.pollClosingDate.value).toString().split(', ')[1]} (CST), ~${currentDistrictData.reporting.displayValue} votes in.`
                                    }
                                }
                                sendMSG(msg, true, 'house');
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
                        if (candidate.name === 'Write-ins') { candidate.name = 'Others'; }
                        let msg = {
                            "state": currentStateData.abbreviation,
                            "district": null,
                            "type": "SENATE",
                            "msgType": "projection",
                            "main": `${candidate.name} (${candidate.party[0].toUpperCase()})`,
                            "winnerParty": candidate.party[0].toUpperCase(),
                            "submain": [{
                                "title": "Votes Received:",
                                "description": `${candidate.stats.votes.toLocaleString()} votes (${candidate.stats.percent})`
                            }, {
                                "title": "Runner Up: ",
                                "description": `${sortedCandidates[1]?.name || 'N/A'} (${sortedCandidates[1]?.party[0].toUpperCase() || 'N/A'}) - ${sortedCandidates[1]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[1]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[1]?.party]?.stats.votes || 0)} behind]`
                            }],
                            "footer": {
                                "text": `Polls closed at ${convertToCst(currentStateData.pollClosingDate.value).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`
                            }
                        }
                        sendMSG(msg, true, 'senate');
                    } else {
                        if ((!updated && (lastUpdateData[candidate.party].stats.votes !== candidate.stats.votes))) {
                            updated = true;
                            if (sortedCandidates[0]?.name === 'Write-ins') { sortedCandidates[0].name = 'Others'; }
                            if (sortedCandidates[1]?.name === 'Write-ins') { sortedCandidates[1].name = 'Others'; }
                            if (sortedCandidates[2]?.name === 'Write-ins') { sortedCandidates[2].name = 'Others'; }

                            let msg = {
                                "state": currentStateData.abbreviation,
                                "district": null,
                                "type": "SENATE",
                                "msgType": "update",
                                "submain": [{
                                    "title": `${sortedCandidates[0]?.name || 'N/A'} (${sortedCandidates[0]?.party[0].toUpperCase() || 'N/A'})`,
                                    "description": `${sortedCandidates[0]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[0]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[0]?.party]?.stats.votes || 0)} behind]`
                                }, {
                                    "title": `${sortedCandidates[1]?.name || 'N/A'} (${sortedCandidates[1]?.party[0].toUpperCase() || 'N/A'})`,
                                    "description": `${sortedCandidates[1]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[1]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[1]?.party]?.stats.votes || 0)} behind]`
                                }, {
                                    "title": `${sortedCandidates[2]?.name || 'N/A'} (${sortedCandidates[2]?.party[0].toUpperCase() || 'N/A'})`,
                                    "description": `${sortedCandidates[2]?.stats.votes.toLocaleString() || 'N/A'} votes (${sortedCandidates[2]?.stats.percent || 'N/A'}) - [${candidate.stats.votes - (lastUpdateData[sortedCandidates[2]?.party]?.stats.votes || 0)} behind]`
                                }],
                                "footer": {
                                    "text": `Polls closed at ${convertToCst(currentStateData.pollClosingDate.value).toString().split(', ')[1]} (CST), ~${currentStateData.reporting.displayValue} votes in.`
                                }
                            }
                            sendMSG(msg, true, 'senate');
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

let discordQueue = [];

//let sentMsg = false;
function sendMSG(msg, sendOnly, type) {
    //console.log(msg, msg.length);

    if (!sendOnly) {

    }

    //if (sentMsg) { return; }
    //sentMsg = true;
    const msgToEmbed = function (msg) {
        if (msg.msgType === 'projection') {
            let title = "";
            if (msg.type === 'GENERAL') {
                title = `${msg.state.toUpperCase()} GENERAL ELECTION PROJECTION [${msg.availableElectoralVotes} Votes]`;
            } else if (msg.type === 'SENATE') {
                title = `${msg.state.toUpperCase()} [SENATE] PROJECTION`;
            } else if (msg.type === 'HOUSE') {
                title = `${msg.state.toUpperCase()} [HOUSE] ${msg.district.toUpperCase()} PROJECTION`;
            }
            let msgUpdated = {
                "content": null,
                "embeds": [
                    {
                        "title": title,
                        "color": 5814783,
                        "fields": [
                            {
                                "name": "✅ " + msg.main,
                                "value": msg.submain[0].description
                            },
                            {
                                "name": msg.submain[1].title,
                                "value": msg.submain[1].description
                            }
                        ],
                        "footer": {
                            "text": msg.footer.text
                        }
                    }
                ],
                "attachments": []
            }
            if (msg.winnerParty) {
                msgUpdated.embeds[0].title = "📣" + " " + msgUpdated.embeds[0].title + " " + ((msg.winnerParty === 'R') ? '🔴' : (msg.winnerParty === 'D') ? '🔵' : '⚪')
            }
            return msgUpdated;
        } else if (msg.msgType === 'update') {
            let title = "";
            if (msg.type === 'GENERAL') {
                title = `${msg.state.toUpperCase()} GENERAL ELECTION UPDATE [${msg.availableElectoralVotes} Votes]`;
            } else if (msg.type === 'SENATE') {
                title = `${msg.state.toUpperCase()} [SENATE] UPDATE`;
            } else if (msg.type === 'HOUSE') {
                title = `${msg.state.toUpperCase()} [HOUSE] ${msg.district.toUpperCase()} UPDATE`;
            }
            let msgUpdated = {
                "content": null,
                "embeds": [
                    {
                        "title": title,
                        "color": 5814783,
                        "fields": [
                            {
                                "name": msg.submain[0].title,
                                "value": msg.submain[0].description
                            },
                            {
                                "name": msg.submain[1].title,
                                "value": msg.submain[1].description
                            },
                            {
                                "name": msg.submain[2].title,
                                "value": msg.submain[2].description
                            }
                        ],
                        "footer": {
                            "text": msg.footer.text
                        }
                    }
                ],
                "attachments": []
            }
            msgUpdated.embeds[0].title = "🚨 " + msgUpdated.embeds[0].title
            return msgUpdated;
        }
    }
    msg = msgToEmbed(msg);
    discordQueue.push(msg);
}

setInterval(() => {
    console.log(process.env.discord)
    if (discordQueue.length > 0) {
        fetch(process.env.DISCORD, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(discordQueue[0])
        })//.then(res => res.json()).then(data => console.log(data)).catch(err => console.log(err));
        discordQueue.shift();
    }
}, 500);
