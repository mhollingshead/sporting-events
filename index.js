const axios = require("axios");
const fs = require("fs").promises;

const apiKey = process.env.SPORTSDB_API_KEY;

if (!apiKey) {
  throw new Error("Missing API key! Set SPORTSDB_API_KEY as an environment variable.");
}

const leagues = {
    4328: "Premier League",
    4380: "NHL",
    4387: "NBA",
    4391: "NFL",
    4424: "MLB",
};

const api = axios.create({
    baseURL: "https://www.thesportsdb.com/api/v2/json",
    headers: {
        "X-API-KEY": apiKey,
    },
});

async function getSeasons(leagueId) {
    console.log(`Getting seasons for league ${leagues[leagueId]}`)
    const res = await api.get(`/list/seasons/${leagueId}`);
    return res.data?.list || [];
}

async function getLeagueSchedule(leagueId, season) {
    console.log(`Getting schedule for league ${leagueId}, ${season} season`);
    const res = await api.get(`/schedule/league/${leagueId}/${season}`);
    return res.data?.schedule || [];
}

async function main() {
    const seasonResults = await Promise.all(
        Object.keys(leagues).map((leagueId) => getSeasons(leagueId))
    );

    const scheduleResults = await Promise.all(
        Object.keys(leagues).map(async (leagueId, idx) => {
            const leagueName = leagues[leagueId];
            const seasons = seasonResults[idx];

            if (seasons.length === 0) {
                console.warn(`⚠️ No seasons found for ${leagueName}`);
                return { league: leagueName, events: [] };
            }

            // assume the last season in the array is current
            const latestSeason = seasons[seasons.length - 1].strSeason;
            console.log(`Fetching ${leagueName} schedule for ${latestSeason}...`);

            const events = await getLeagueSchedule(leagueId, latestSeason);
            return { league: leagueName, season: latestSeason, events };
        })
    );

    let allEvents = [];

    scheduleResults.forEach((result) => {
        const leagueName = result.league;

        const simplified = result.events.map((ev) => ({
            league: leagueName,
            title: ev.strEvent,
            timestamp: ev.strTimestamp,
            homeBadge: ev.strHomeTeamBadge,
            awayBadge: ev.strAwayTeamBadge
        }));

        allEvents = allEvents.concat(simplified).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    await fs.writeFile("games.json", JSON.stringify(allEvents, null, 2));
    console.log(`✅ games.json written successfully with ${allEvents.length} events`);
}

main().catch((err) => {
    console.error("❌ Error:", err.message);
});