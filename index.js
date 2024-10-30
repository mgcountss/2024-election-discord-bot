import fs from 'fs';
import fetch from 'node-fetch';

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

setInterval(async () => {
    if (currentState[1] >= Object.keys(states).length) {
        currentState[1] = 0;
    }
    currentState[0] = Object.keys(states)[currentState[1]];
    console.log(`Current state: ${currentState[0]}`);
    const currentStateData = await fetchStateData(currentState[0]);
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
                        percent: currentStateData.races[0].candidates[r].statistics.percent.doubleValue,
                        electoralVotes: currentStateData.races[0].candidates[r].statistics.electoralVotes.doubleValue
                    }
                };
            }
        }
    }
    states[currentState[0]].candidates = candidates;
    /*{
    "_generated": "2024-10-26T01:52:41.834Z",
    "id": 10,
    "fips": "12",
    "name": "FLORIDA",
    "abbreviation": "FL",
    "displayName": "Florida",
    "shortDisplayName": "Fla.",
    "availableElectoralVotes": 30,
    "exitPolls": true,
    "otherStateResults": {
      "senate": true,
      "electoral": true,
      "house": true
    },
    "races": [
      {
        "id": 10,
        "name": "FLORIDA",
        "abbreviation": "FLO-P-",
        "displayName": "Florida",
        "shortDisplayName": "Fla. All",
        "availableElectoralVotes": 30,
        "exitPolls": true,
        "competitive": false,
        "candidates": [
          {
            "id": 895,
            "displayName": "Jill Stein",
            "shortDisplayName": "J. Stein",
            "firstName": "Jill",
            "lastName": "Stein",
            "party": "others",
            "major": false,
            "incumbent": false,
            "winner": false,
            "runoff": false,
            "participated": true,
            "dropped": false,
            "aggregate": false,
            "order": 6,
            "partyOrder": 6,
            "statistics": {
              "votes": {
                "displayText": "Total Votes",
                "displayValue": "0",
                "doubleValue": 0,
                "value": 0
              },
              "percent": {
                "displayText": "Pct.",
                "displayValue": "0%",
                "doubleValue": 0,
                "value": 0
              },
              "electoralVotes": {
                "displayText": "Electoral Votes",
                "displayValue": "0",
                "doubleValue": 0,
                "value": 0
              }
            }
          },
  }*/
    currentState[1] = (currentState[1] + 1);
}, 2000);

setInterval(async () => {
    fs.writeFileSync('states.json', JSON.stringify(states, null, 2));
}, 5000);