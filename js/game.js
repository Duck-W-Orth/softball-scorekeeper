// game.js — game engine

const Game = {
    state: null,
    undoStack: [],

    create(lineup, isHome) {
        this.state = {
            lineup: lineup, // [{id, name, number}]
            isHome: !!isHome, // true = we bat in bottom half
            inning: 1,
            half: 'top', // top = first half, bottom = second half
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
                bb: 0, sf: 0, rbi: 0, r: 0, k: 0, foulOut: 0
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

    // Are we batting in the current half-inning?
    isOurBat() {
        if (this.state.isHome) {
            return this.state.half === 'bottom'; // Home team bats in bottom
        }
        return this.state.half === 'top'; // Away team bats in top
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
    // outcome: '1B','2B','3B','HR','BB','K','FO','GO','FLY','LO','SF','FC','DP','ERR'
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
                if (r.fromBase === 0) {
                    // This is the batter (used in DP)
                    if (r.toBase === 'out') {
                        this.state.outs++;
                    }
                    return;
                }
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
        // Check if batter was marked out via runnerResults (for stretching on hits, DP, ERR)
        const batterMarkedOut = runnerResults && runnerResults.some(
            r => r.fromBase === 0 && r.toBase === 'out'
        );
        // Check where batter was placed via runnerResults (for hits where batter advances beyond default)
        const batterPlacement = runnerResults && runnerResults.find(
            r => r.fromBase === 0 && r.toBase !== 'out'
        );

        switch (outcome) {
            case '1B':
                ps.ab++; ps.h++; ps.singles++;
                if (batterMarkedOut) {
                    this.state.outs++;
                } else if (batterPlacement) {
                    this.state.bases[batterPlacement.toBase - 1] = batter.id;
                } else {
                    this.state.bases[0] = batter.id;
                }
                rbi = scoredRunners.length;
                break;
            case '2B':
                ps.ab++; ps.h++; ps.doubles++;
                if (batterMarkedOut) {
                    this.state.outs++;
                } else if (batterPlacement) {
                    this.state.bases[batterPlacement.toBase - 1] = batter.id;
                } else {
                    this.state.bases[1] = batter.id;
                }
                rbi = scoredRunners.length;
                break;
            case '3B':
                ps.ab++; ps.h++; ps.triples++;
                if (batterMarkedOut) {
                    this.state.outs++;
                } else if (batterPlacement) {
                    this.state.bases[batterPlacement.toBase - 1] = batter.id;
                } else {
                    this.state.bases[2] = batter.id;
                }
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
            case 'DP':
                ps.ab++;
                rbi = scoredRunners.length;
                break;
            case 'ERR':
                ps.ab++;
                // Reached on error — no hit credit. Batter placement handled below.
                rbi = scoredRunners.length;
                break;
            case 'FC':
                ps.ab++;
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

        // For DP/ERR: if the batter wasn't marked out via runnerResults, place them on 1st
        if (outcome === 'DP' || outcome === 'ERR') {
            if (!batterMarkedOut) {
                if (batterPlacement) {
                    this.state.bases[batterPlacement.toBase - 1] = batter.id;
                } else {
                    this.state.bases[0] = batter.id;
                }
            } else {
                this.state.outs++;
            }
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
        // Switch to the other half
        const nextHalf = (this.state.half === 'top') ? 'bottom' : 'top';
        // If completing the bottom half, advance inning
        if (this.state.half === 'bottom') {
            this.state.inning++;
        }
        this.state.half = nextHalf;
        this.state.oppInningStats = { runs: 0, walks: 0, ks: 0 };
        this.save();
    },

    endOppHalf() {
        this.pushUndo();
        this.state.oppScore += this.state.oppInningStats.runs;

        // Switch to the other half
        const nextHalf = (this.state.half === 'top') ? 'bottom' : 'top';
        // If we're completing the bottom half, the full inning is done — advance inning number
        if (this.state.half === 'bottom') {
            this.state.inning++;
        }
        this.state.half = nextHalf;
        this.state.outs = 0;
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
                    // Only force runners who are directly pushed by the batter going to 1st.
                    // Runner on 1st is forced to 2nd; runner on 2nd is forced to 3rd ONLY if 1st is also occupied;
                    // runner on 3rd is forced home ONLY if 1st AND 2nd are occupied.
                    // Runners NOT in a force chain do NOT advance.
                    if (i === 0) {
                        // Runner on 1st: always forced
                        defaultTo = 2;
                        if (bases[1]) {
                            // 2nd occupied too, push to 3rd
                            defaultTo = 2; // this runner still goes to 2nd
                        }
                    } else if (i === 1 && bases[0]) {
                        // Runner on 2nd, forced only if 1st is occupied
                        defaultTo = 3;
                        if (bases[2] && bases[0]) {
                            defaultTo = 3; // still goes to 3rd
                        }
                    } else if (i === 2 && bases[1] && bases[0]) {
                        // Runner on 3rd, forced only if 1st AND 2nd are occupied (bases loaded)
                        defaultTo = 'home';
                    } else {
                        // Not forced — stays put
                        defaultTo = i + 1; // i+1 == current base (1-indexed)
                    }
                    break;
                case 'FC':
                case 'DP':
                    defaultTo = 'out';
                    break;
                case 'ERR':
                    defaultTo = i + 1; // default: stay on current base
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
        if (['FC', 'DP', 'ERR'].includes(outcome)) return true;
        return this.state.bases.some(b => b !== null);
    }
};
