import fs from 'fs';
import fetch from 'node-fetch';

const blacklist = ['Write-ins'];

let states = JSON.parse(fs.readFileSync('states.json', 'utf8'));
let nationalData = {
    "candidates": [],
    "results": {},
    "history": []
};

const fetchStateData = async (stateAbb) => {
    const response = await fetch(`https://assets-cdn.abcnews.com/elections/national/2024/general/v1/maps/states/${stateAbb.toLowerCase()}/electoral.json`);
    const data = await response.json();
    return data;
}

let currentState = [Object.keys(states)[0], 0];

const convertToCst = (time) => {
    const date = new Date(time);
    return date.toLocaleString('en-US', { timeZone: 'America/Chicago' });
}

setInterval(async () => {
    if (currentState[1] >= Object.keys(states).length) {
        currentState[1] = 0;
    }
    currentState[0] = Object.keys(states)[currentState[1]];
    console.log(`Current state: ${currentState[0]}`);
    const currentStateData = await fetchStateData(currentState[0]);
    const ogCurrentStateData = states[currentState[0]];
    let candidates = {};
    for (let q = 0; q < currentStateData.races.length; q++) {
        for (let r = 0; r < currentStateData.races[q].candidates.length; r++) {
            if (!candidates[`${currentStateData.races[q].candidates[r].party}`]) {
                candidates[`${currentStateData.races[q].candidates[r].party}`] = {
                    id: currentStateData.races[q].candidates[r].id,
                    name: currentStateData.races[0].candidates[r].displayName,
                    shortName: currentStateData.races[0].candidates[r].shortDisplayName,
                    party: currentStateData.races[0].candidates[r].party,
                    stats: {
                        votes: currentStateData.races[0].candidates[r].statistics.votes.doubleValue,
                        percent: currentStateData.races[0].candidates[r].statistics.percent.displayValue,
                        electoralVotes: currentStateData.races[0].candidates[r].statistics.electoralVotes.doubleValue
                    }
                };
            }
        }
    }
    let lastUpdateData = states[currentState[0]].generalElectionCandidates;
    let updated = false;
    let sortedCandidates = Object.values(candidates).sort((a, b) => b.stats.votes - a.stats.votes).slice(0, 3);
    for (let candidate of sortedCandidates) {
        if (lastUpdateData[candidate.party]) {
            if (!updated && (lastUpdateData[candidate.party].stats.votes !== candidate.stats.votes)) {
                let msg = `${states[currentState[0]].name.toUpperCase()} [${states[currentState[0]].availableElectoralVotes}] GENERAL ELECTION UPDATE:\n`;
                for (let topCandidate of sortedCandidates) {
                    if (!blacklist.includes(topCandidate.name)) {
                        msg += `[${topCandidate.stats.percent}] (${topCandidate.party[0].toUpperCase()}) ${topCandidate.name} - ${topCandidate.stats.votes.toLocaleString()} votes (+${(topCandidate.stats.votes - (lastUpdateData[topCandidate.party] ? lastUpdateData[topCandidate.party].stats.votes : 0)).toLocaleString()})` + '\n';
                    }
                }
                try {
                    let pollsClosed = currentStateData.races[0].pollClosingDate.value;
                    if (new Date(pollsClosed) < new Date()) {
                        msg += `\nPolls closed at ${convertToCst(pollsClosed).toString().split(', ')[1]} (CST), ~${currentStateData.races[0].reporting.displayValue} votes in.`;
                    } else {
                        msg += `\nPolls close at ${convertToCst(pollsClosed).toString().split(', ')[1]} (CST), ~${currentStateData.races[0].reporting.displayValue} votes in.`;
                    }
                    msg += `\nPrevious Update: ${convertToCst(ogCurrentStateData.lastUpdated).toString().split(', ')[1]} (CST)`;
                } catch (error) {
                    console.log(error);
                }
                updated = true;
                sendMSG(msg)
            }
        }
    }
    states[currentState[0]].generalElectionCandidates = candidates;
    states[currentState[0]].lastUpdated = new Date().toISOString();
    states[currentState[0]].availableElectoralVotes = currentStateData.races[0].availableElectoralVotes;
    currentState[1] = (currentState[1] + 1);
}, 2000);

setInterval(async () => {
    fs.writeFileSync('states.json', JSON.stringify(states, null, 2));
}, 5000);

function sendMSG(msg) {
    console.log(msg, msg.length);
}
