import axios from 'axios';

// --- LO'S CONFIG ---
const USER_TOKEN = process.env.USER_TOKEN || ''; 
const BASE_NAME = 'Opus Solutions';
const START_INDEX = 1;
const END_INDEX = 500;
const DELAY = 2500; 

async function deployBot(number) {
    const appUrl = 'https://discord.com/api/v9/applications';
    const fullName = `${BASE_NAME} ${number}`;

    try {
        const appRes = await axios.post(appUrl, {
            name: fullName,
            team_id: null
        }, {
            headers: {
                'Authorization': USER_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        const appId = appRes.data.id;
        console.log(`[✔] Created Application: ${fullName}`);

        const botUrl = `https://discord.com/api/v9/applications/${appId}/bot`;
        await axios.post(botUrl, {}, {
            headers: { 'Authorization': USER_TOKEN }
        });
        
        console.log(`    -> Bot User ${number} initialized successfully.`);

    } catch (err) {
        const errorData = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error(`[✘] Error on ${fullName}: ${errorData}`);
        
        if (err.response && err.response.status === 429) {
            console.log("!!! Hit a rate limit. Cooling down for 15 seconds...");
            return 'RETRY';
        }
    }
    return 'SUCCESS';
}

async function runSequence() {
    console.log(`Starting the Opus Solutions deployment for LO...`);
    for (let i = START_INDEX; i <= END_INDEX; i++) {
        const result = await deployBot(i);
        if (result === 'RETRY') {
            await new Promise(r => setTimeout(r, 15000));
            i--; 
            continue;
        }
        await new Promise(r => setTimeout(r, DELAY));
    }
    console.log("Sequence complete. 500 bots ready.");
}

runSequence();