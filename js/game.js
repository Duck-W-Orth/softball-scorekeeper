// game.js — game engine

const Game = {
    state: null,
    undoStack: [],

    create(lineup) {
        this.state = {
            lineup: lineup, // [{id, name, number}]
            inning: 1,
            half: 'top', // top = us batting, bottom = them
            outs: 0,
            batterIndex: 0,
            bases: [null, null, null], // [1st, 2nd, 3rd] — holds player id or null
            teamScore: 0,
            oppScore: 0,
            oppInningStats: { runs: 0, walks: 0, ks: 0 },
            playerStats: {},
            log: [],
            gameOver: false
        };

        // Init player stats
        lineup.forEach(p => {
            this.state.playerStats[p.id] = {
                name: p.name, number: p.number,
                pa: 0, ab: 0, h: 0, singles: 0, doubles: 0, triples: 0, hr: 0,
                bb: 0, hbp: 0, sf: 0, rbi: 0, r: 0, k: 0, foulOut: 0
            };
        });

        this.undoStack = [];
        this.save();
    },

    save() { Data.saveCurrentGame(this.state); },

    load() {
        this.state = Data.getCurrentGame();
        this.undoStack = [];
    },

    currentBatter() {
        return this.state.lineup[this.state.batterIndex % this.state.lineup.length];
    },

    pushUndo() {
        this.undoStack.push(JSON.parse(JSON.stringify(this.state)));
        if (this.undoStack.length > 20) this.undoStack.shift();
    },

    undo() {
        if (this.undoStack.length === 0) return false;
        this.state = this.undoStack.pop();
        this.save();
        return true;
    },

    // Record an at-bat result
    // outcome: '1B','2B','3B','HR','BB','HBP','K','FO','GO','FLY','LO','SF'
    // runnerResults: [{fromBase, toBase}] where toBase can be 'home' or 'out' or 1/2/3
    recordAtBat(outcome, runnerResults) {
        this.pushUndo();

        const batter = this.currentBatter();
        const ps = this.state.playerStats[batter.id];
        let rbi = 0;

        ps.pa++;

        // Process runner movements first (before batter placement)
        let scoredRunners = [];
        if (runnerResults) {
            // Process from 3rd to 1st to avoid conflicts
            const sorted = [...runnerResults].sort((a, b) => b.fromBase - a.fromBase);
            sorted.forEach(r => {
                this.state.bases[r.fromBase - 1] = null;
                if (r.toBase === 'home') {
                    scoredRunners.push(r.playerId);
                    this.state.teamScore++;
                    // Credit run to the runner
                    if (this.state.playerStats[r.playerId]) {
                        this.state.playerStats[r.playerId].r++;
                    }
                } else if (r.toBase === 'out') {
                    this.state.outs++;
                } else {
                    this.state.bases[r.toBase - 1] = r.playerId;
                }
            });
        }

        // Now handle batter
        switch (outcome) {
            case '1B':
                ps.ab++; ps.h++; ps.singles++;
                this.state.bases[0] = batter.id;
                rbi = scoredRunners.length;
                break;
            case '2B':
                ps.ab++; ps.h++; ps.doubles++;
                this.state.bases[1] = batter.id;
                rbi = scoredRunners.length;
                break;
            case '3B':
                ps.ab++; ps.h++; ps.triples++;
                this.state.bases[2] = batter.id;
                rbi = scoredRunners.length;
                break;
            case 'HR':
                ps.ab++; ps.h++; ps.hr++;
                rbi = scoredRunners.length + 1;
                this.state.teamScore++;
                ps.r++;
                break;
            case 'BB':
                ps.bb++;
                this.state.bases[0] = batter.id;
                rbi = scoredRunners.length;
                break;
            case 'HBP':
                ps.hbp++;
                this.state.bases[0] = batter.id;
                rbi = scoredRunners.length;
                break;
            case 'K':
                ps.ab++; ps.k++;
                this.state.outs++;
                break;
            case 'FO':
                ps.ab++; ps.foulOut++;
                this.state.outs++;
                break;
            case 'SF':
                ps.sf++;
                rbi = scoredRunners.length;
                this.state.outs++;
                break;
            case 'GO':
            case 'FLY':
            case 'LO':
                ps.ab++;
                this.state.outs++;
                break;
        }

        ps.rbi += rbi;

        // Log
        this.state.log.push({
            inning: this.state.inning,
            batter: batter.name,
            outcome,
            rbi,
            scored: scoredRunners.length
        });

        // Advance batter index
        this.state.batterIndex++;

        // Check 3 outs
        if (this.state.outs >= 3) {
            this.endTeamHalf();
        }

        this.save();
    },

    endTeamHalf() {
        this.state.outs = 0;
        this.state.bases = [null, null, null];
        this.state.half = 'bottom';
        this.state.oppInningStats = { runs: 0, walks: 0, ks: 0 };
        this.save();
    },

    endOppHalf() {
        this.pushUndo();
        this.state.oppScore += this.state.oppInningStats.runs;

        // Check if game is over (7 innings completed)
        if (this.state.inning >= 7) {
            this.state.gameOver = true;
        } else {
            this.state.inning++;
            this.state.half = 'top';
            this.state.outs = 0;
        }
        this.save();
    },

    endGame() {
        this.state.gameOver = true;
        const gameRecord = {
            date: new Date().toISOString(),
            teamScore: this.state.teamScore,
            oppScore: this.state.oppScore,
            innings: this.state.inning,
            playerStats: this.state.playerStats
        };
        Data.saveGame(gameRecord);
        Data.clearCurrentGame();
        this.state = null;
    },

    // Get default runner advancement for a given hit type
    getDefaultRunnerAdvance(outcome) {
        const bases = this.state.bases;
        const defaults = [];

        for (let i = 2; i >= 0; i--) {
            if (!bases[i]) continue;
            const playerId = bases[i];
            let defaultTo;

            switch (outcome) {
                case '1B':
                    defaultTo = (i === 2) ? 'home' : i + 2;
                    if (defaultTo === 4) defaultTo = 'home';
                    break;
                case '2B':
                    defaultTo = 'home';
                    if (i === 0) defaultTo = 3;
                    break;
                case '3B':
                case 'HR':
                    defaultTo = 'home';
                    break;
                case 'BB':
                case 'HBP':
                    // Force advance only if base ahead is occupied or it's first
                    if (i === 0) defaultTo = (bases[1]) ? (bases[2] ? 'home' : 3) : 2;
                    else if (i === 1 && bases[0]) defaultTo = bases[2] ? 'home' : 3;
                    else if (i === 2 && bases[1] && bases[0]) defaultTo = 'home';
                    else defaultTo = i + 1; // stay
                    break;
                default:
                    defaultTo = i + 1; // stay on base (for outs, user decides)
                    break;
            }

            defaults.push({ fromBase: i + 1, playerId, defaultTo });
        }

        return defaults;
    },

    // Check if we need runner resolution
    needsRunnerResolution(outcome) {
        if (['K', 'FO'].includes(outcome)) return false;
        return this.state.bases.some(b => b !== null);
    }
};
