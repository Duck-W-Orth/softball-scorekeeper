// data.js — localStorage persistence layer

const Data = {
    _get(key) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    },
    _set(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    },

    // Roster
    getRoster() { return this._get('roster') || []; },
    saveRoster(roster) { this._set('roster', roster); },

    addPlayer(name, number) {
        const roster = this.getRoster();
        if (roster.length >= 30) return false;
        const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        roster.push({ id, name, number });
        this.saveRoster(roster);
        return true;
    },

    removePlayer(id) {
        const roster = this.getRoster().filter(p => p.id !== id);
        this.saveRoster(roster);
    },

    // Current Game
    getCurrentGame() { return this._get('currentGame'); },
    saveCurrentGame(game) { this._set('currentGame', game); },
    clearCurrentGame() { localStorage.removeItem('currentGame'); },

    deleteLastGame() {
        const games = this.getGames();
        games.pop();
        this._set('games', games);
    },

    deleteGame(index) {
        const games = this.getGames();
        if (index >= 0 && index < games.length) {
            games.splice(index, 1);
            this._set('games', games);
        }
    },

    clearAllGames() {
        this._set('games', []);
    },

    // Completed Games
    getGames() { return this._get('games') || []; },
    saveGame(game) {
        const games = this.getGames();
        games.push(game);
        this._set('games', games);
    },

    // Season stats (computed from games)
    getAllPlayerStats() {
        const games = this.getGames();
        const stats = {};

        games.forEach(game => {
            if (!game.playerStats) return;
            Object.entries(game.playerStats).forEach(([playerId, ps]) => {
                if (!stats[playerId]) {
                    stats[playerId] = { name: ps.name, number: ps.number, games: 0, pa: 0, ab: 0, h: 0, singles: 0, doubles: 0, triples: 0, hr: 0, bb: 0, sf: 0, rbi: 0, r: 0, k: 0, foulOut: 0 };
                }
                const s = stats[playerId];
                s.games++;
                s.pa += ps.pa || 0;
                s.ab += ps.ab || 0;
                s.h += ps.h || 0;
                s.singles += ps.singles || 0;
                s.doubles += ps.doubles || 0;
                s.triples += ps.triples || 0;
                s.hr += ps.hr || 0;
                s.bb += ps.bb || 0;
                s.sf += ps.sf || 0;
                s.rbi += ps.rbi || 0;
                s.r += ps.r || 0;
                s.k += ps.k || 0;
                s.foulOut += ps.foulOut || 0;
            });
        });

        return stats;
    }
};
