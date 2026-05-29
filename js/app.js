// app.js — UI controller

document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    function showView(name) {
        views.forEach(v => v.classList.remove('active'));
        navBtns.forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + name).classList.add('active');
        document.querySelector(`[data-view="${name}"]`).classList.add('active');

        if (name === 'stats') { Stats.renderStatsTable('stats-table-container'); renderGameHistory(); }
        if (name === 'home') renderHome();
        if (name === 'roster') renderRoster();
        if (name === 'game') renderGameView();
    }

    navBtns.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

    // Home
    function renderHome() {
        const games = Data.getGames();
        const current = Data.getCurrentGame();
        const resumeBtn = document.getElementById('btn-resume-game');
        resumeBtn.style.display = current ? 'block' : 'none';

        const summary = document.getElementById('season-summary');
        if (games.length > 0) {
            const wins = games.filter(g => g.teamScore > g.oppScore).length;
            summary.innerHTML = `<p>Season: ${games.length} games | ${wins}W - ${games.length - wins}L</p>`;
        } else {
            summary.innerHTML = '<p>No games played yet. Add players to your roster and start a game!</p>';
        }
    }

    document.getElementById('btn-new-game').addEventListener('click', () => {
        const current = Data.getCurrentGame();
        if (current && !confirm('Abandon current game in progress?')) return;
        // Clear any in-progress game so we get a fresh lineup setup
        Data.clearCurrentGame();
        Game.state = null;
        document.getElementById('lineup-setup').style.display = 'block';
        document.getElementById('live-game').style.display = 'none';
        // Switch to game view without calling renderGameView (which would auto-load)
        views.forEach(v => v.classList.remove('active'));
        navBtns.forEach(b => b.classList.remove('active'));
        document.getElementById('view-game').classList.add('active');
        document.querySelector('[data-view="game"]').classList.add('active');
        renderLineupSetup();
    });

    document.getElementById('btn-resume-game').addEventListener('click', () => {
        Game.load();
        document.getElementById('lineup-setup').style.display = 'none';
        document.getElementById('live-game').style.display = 'block';
        showView('game');
        renderLiveGame();
    });

    // Roster
    function renderRoster() {
        const roster = Data.getRoster();
        const list = document.getElementById('roster-list');
        document.getElementById('roster-count').textContent = roster.length;

        list.innerHTML = roster.map(p => `
            <div class="roster-item">
                <span class="player-info"><span class="player-number">${p.number || ''}</span>${p.name}</span>
                <button class="btn-remove" data-id="${p.id}">×</button>
            </div>
        `).join('');

        list.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                Data.removePlayer(btn.dataset.id);
                renderRoster();
            });
        });
    }

    document.getElementById('btn-add-player').addEventListener('click', () => {
        const nameInput = document.getElementById('new-player-name');
        const numInput = document.getElementById('new-player-number');
        const name = nameInput.value.trim();
        const number = numInput.value.trim();
        if (!name) return;
        if (Data.addPlayer(name, number)) {
            nameInput.value = '';
            numInput.value = '';
            renderRoster();
        } else {
            alert('Roster is full (30 max)');
        }
    });

    // Lineup Setup
    let selectedLineup = [];

    function renderLineupSetup() {
        selectedLineup = [];
        const roster = Data.getRoster();
        const available = document.getElementById('available-players');
        const order = document.getElementById('lineup-order');
        const startBtn = document.getElementById('btn-start-game');

        // Pre-fill team name from last game
        const savedTeamName = localStorage.getItem('teamName') || '';
        document.getElementById('input-team-name').value = savedTeamName;

        function render() {
            available.innerHTML = roster.map(p => {
                const inLineup = selectedLineup.find(l => l.id === p.id);
                return `<span class="player-chip ${inLineup ? 'selected' : ''}" data-id="${p.id}">${p.number ? '#' + p.number + ' ' : ''}${p.name}</span>`;
            }).join('');

            order.innerHTML = selectedLineup.map((p, i) => `
                <div class="lineup-item">
                    <span class="order-num">${i + 1}</span>
                    <span>${p.number ? '#' + p.number + ' ' : ''}${p.name}</span>
                    <button class="btn-remove-lineup" data-idx="${i}">×</button>
                </div>
            `).join('');

            startBtn.disabled = selectedLineup.length < 2;

            available.querySelectorAll('.player-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const id = chip.dataset.id;
                    const idx = selectedLineup.findIndex(l => l.id === id);
                    if (idx >= 0) {
                        selectedLineup.splice(idx, 1);
                    } else {
                        const player = roster.find(p => p.id === id);
                        selectedLineup.push(player);
                    }
                    render();
                });
            });

            order.querySelectorAll('.btn-remove-lineup').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedLineup.splice(parseInt(btn.dataset.idx), 1);
                    render();
                });
            });
        }

        render();

        // Home/Away toggle
        document.querySelectorAll('#home-away-select .toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#home-away-select .toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    document.getElementById('btn-start-game').addEventListener('click', () => {
        const isHome = document.querySelector('#home-away-select .toggle-btn.active').dataset.side === 'home';
        const teamName = document.getElementById('input-team-name').value.trim() || 'Us';
        const oppName = document.getElementById('input-opp-name').value.trim() || 'Them';
        // Remember team name for next time
        localStorage.setItem('teamName', teamName);
        Game.create(selectedLineup, isHome, teamName, oppName);
        document.getElementById('lineup-setup').style.display = 'none';
        document.getElementById('live-game').style.display = 'block';
        renderLiveGame();
    });

    // Game View Router
    function renderGameView() {
        const current = Data.getCurrentGame();
        if (current) {
            if (!Game.state) Game.load();
            document.getElementById('lineup-setup').style.display = 'none';
            document.getElementById('live-game').style.display = 'block';
            renderLiveGame();
        } else {
            document.getElementById('lineup-setup').style.display = 'block';
            document.getElementById('live-game').style.display = 'none';
            renderLineupSetup();
        }
    }

    // Live Game Rendering
    function renderLiveGame() {
        const s = Game.state;
        if (!s) return;

        // Scoreboard: if home, we're on the right (Them first); if away, we're on the left (Us first)
        document.getElementById('team-score').textContent = `${s.teamName}: ${s.teamScore}`;
        document.getElementById('opp-score').textContent = `${s.oppName}: ${s.oppScore}`;
        document.getElementById('inning-display').textContent = `Inn: ${s.half === 'top' ? '▲' : '▼'} ${s.inning}`;
        document.getElementById('outs-display').textContent = `Outs: ${s.outs}`;

        // Bases
        document.getElementById('base-1').classList.toggle('occupied', !!s.bases[0]);
        document.getElementById('base-2').classList.toggle('occupied', !!s.bases[1]);
        document.getElementById('base-3').classList.toggle('occupied', !!s.bases[2]);

        // Half toggle labels
        const toggleBtns = document.querySelectorAll('#half-inning-toggle .toggle-btn');
        const ourBat = Game.isOurBat();
        toggleBtns[0].textContent = s.half === 'top' ? (ourBat ? '🏏 Batting' : '🧤 Field') : (ourBat ? '🏏 Batting' : '🧤 Field');
        toggleBtns[1].textContent = s.half === 'top' ? (!ourBat ? '🏏 Batting' : '🧤 Field') : (!ourBat ? '🏏 Batting' : '🧤 Field');
        // Actually just show which half is active
        toggleBtns.forEach(b => b.classList.remove('active'));
        if (s.half === 'top') {
            toggleBtns[0].classList.add('active');
        } else {
            toggleBtns[1].classList.add('active');
        }

        // Update toggle button labels based on home/away
        if (s.isHome) {
            toggleBtns[0].textContent = '🧤 Field'; // top = opponent bats
            toggleBtns[0].dataset.half = 'top';
            toggleBtns[1].textContent = '🏏 Batting'; // bottom = we bat
            toggleBtns[1].dataset.half = 'bottom';
        } else {
            toggleBtns[0].textContent = '🏏 Batting'; // top = we bat
            toggleBtns[0].dataset.half = 'top';
            toggleBtns[1].textContent = '🧤 Field'; // bottom = opponent bats
            toggleBtns[1].dataset.half = 'bottom';
        }

        const battingPanel = document.getElementById('batting-panel');
        const fieldingPanel = document.getElementById('fielding-panel');

        if (ourBat) {
            battingPanel.style.display = 'block';
            fieldingPanel.style.display = 'none';
            renderBattingPanel();
        } else {
            battingPanel.style.display = 'none';
            fieldingPanel.style.display = 'block';
            renderFieldingPanel();
        }

        if (s.gameOver) {
            document.getElementById('at-bat-actions').innerHTML = '<p style="text-align:center;font-size:18px;">Game Over!</p>';
        }
    }

    function renderBattingPanel() {
        const batter = Game.currentBatter();
        const batterDisplay = document.getElementById('current-batter');
        const orderNum = (Game.state.batterIndex % Game.state.lineup.length) + 1;
        batterDisplay.textContent = `#${orderNum} ${batter.number ? '#' + batter.number + ' ' : ''}${batter.name}`;

        const actions = document.getElementById('at-bat-actions');
        const buttons = [
            { label: '1B', outcome: '1B', cls: 'hit' },
            { label: '2B', outcome: '2B', cls: 'hit' },
            { label: '3B', outcome: '3B', cls: 'hit' },
            { label: 'HR', outcome: 'HR', cls: 'hit' },
            { label: 'BB', outcome: 'BB', cls: 'walk' },
            { label: 'Error', outcome: 'ERR', cls: 'walk' },
            { label: 'FC', outcome: 'FC', cls: 'out' },
            { label: 'K', outcome: 'K', cls: 'out' },
            { label: 'Foul Out', outcome: 'FO', cls: 'out' },
            { label: 'Ground Out', outcome: 'GO', cls: 'out' },
            { label: 'Fly Out', outcome: 'FLY', cls: 'out' },
            { label: 'Line Out', outcome: 'LO', cls: 'out' },
            { label: 'Sac Fly', outcome: 'SF', cls: 'out' },
            { label: 'DP', outcome: 'DP', cls: 'out' },
        ];

        actions.innerHTML = buttons.map(b =>
            `<button class="ab-btn ${b.cls}" data-outcome="${b.outcome}">${b.label}</button>`
        ).join('');

        actions.querySelectorAll('.ab-btn').forEach(btn => {
            btn.addEventListener('click', () => handleAtBat(btn.dataset.outcome));
        });
    }

    function handleAtBat(outcome) {
        if (Game.state.gameOver) return;

        // Error has its own multi-step flow
        if (outcome === 'ERR') {
            showErrorModal();
            return;
        }

        // These outcomes always record an out for the batter
        const batterIsOut = ['K', 'FO', 'GO', 'FLY', 'LO', 'SF'].includes(outcome);

        // If this would be the 3rd out, skip runner resolution — inning is over, no runs score
        if (batterIsOut && Game.state.outs >= 2) {
            Game.recordAtBat(outcome, null);
            renderLiveGame();
            return;
        }

        // If runners on base and it's a play that could advance them
        if (Game.needsRunnerResolution(outcome)) {
            showRunnerModal(outcome);
        } else {
            Game.recordAtBat(outcome, null);
            renderLiveGame();
        }
    }

    function showRunnerModal(outcome) {
        const modal = document.getElementById('runner-modal');
        const decisions = document.getElementById('runner-decisions');
        const defaults = Game.getDefaultRunnerAdvance(outcome);

        // Outcomes where we show the batter in the modal
        const showBatterInModal = ['1B', '2B', '3B', 'DP', 'ERR'].includes(outcome);

        const batter = Game.currentBatter();
        let batterEntry = null;
        if (showBatterInModal) {
            batterEntry = { playerId: batter.id, name: batter.name, number: batter.number };
        }

        if (defaults.length === 0 && !batterEntry) {
            Game.recordAtBat(outcome, []);
            renderLiveGame();
            return;
        }

        const roster = Game.state.lineup;
        let html = '';

        // Render runner decisions
        defaults.forEach(d => {
            const player = roster.find(p => p.id === d.playerId) || { name: 'Runner' };
            const baseLabel = d.fromBase === 1 ? '1st' : d.fromBase === 2 ? '2nd' : '3rd';

            // Build advancement options: stay, each base ahead, score, out
            let advanceOptions = '';
            for (let b = d.fromBase + 1; b <= 3; b++) {
                const label = b === 2 ? '2nd' : '3rd';
                advanceOptions += `<option value="${b}" ${d.defaultTo === b ? 'selected' : ''}>Advances to ${label}</option>`;
            }

            let options = `
                <option value="${d.fromBase}" ${d.defaultTo === d.fromBase ? 'selected' : ''}>Stays at ${baseLabel}</option>
                ${advanceOptions}
                <option value="home" ${d.defaultTo === 'home' ? 'selected' : ''}>Scores</option>
                <option value="out" ${d.defaultTo === 'out' ? 'selected' : ''}>Out</option>
            `;

            // For walks, simplify (no out option, just force logic)
            if (outcome === 'BB') {
                advanceOptions = '';
                for (let b = d.fromBase + 1; b <= 3; b++) {
                    const label = b === 2 ? '2nd' : '3rd';
                    advanceOptions += `<option value="${b}" ${d.defaultTo === b ? 'selected' : ''}>Advances to ${label}</option>`;
                }
                options = `
                    <option value="${d.fromBase}" ${d.defaultTo === d.fromBase ? 'selected' : ''}>Stays at ${baseLabel}</option>
                    ${advanceOptions}
                    <option value="home" ${d.defaultTo === 'home' ? 'selected' : ''}>Scores</option>
                `;
            }

            html += `
                <div class="runner-decision">
                    <label>${player.name} (on ${baseLabel})</label>
                    <select data-from="${d.fromBase}" data-player="${d.playerId}">
                        ${options}
                    </select>
                </div>
            `;
        });

        // Add batter to modal for hits, DP, and ERR
        if (batterEntry) {
            let batterOptions = '';
            if (outcome === '1B') {
                batterOptions = `
                    <option value="1" selected>Safe at 1st</option>
                    <option value="2">Safe at 2nd</option>
                    <option value="out">Out</option>
                `;
            } else if (outcome === '2B') {
                batterOptions = `
                    <option value="2" selected>Safe at 2nd</option>
                    <option value="3">Safe at 3rd</option>
                    <option value="out">Out</option>
                `;
            } else if (outcome === '3B') {
                batterOptions = `
                    <option value="3" selected>Safe at 3rd</option>
                    <option value="out">Out</option>
                `;
            } else if (outcome === 'DP') {
                batterOptions = `
                    <option value="1" selected>Safe at 1st</option>
                    <option value="out">Out</option>
                `;
            } else if (outcome === 'ERR') {
                batterOptions = `
                    <option value="1" selected>Safe at 1st</option>
                    <option value="2">Safe at 2nd</option>
                    <option value="3">Safe at 3rd</option>
                    <option value="out">Out</option>
                `;
            }

            html += `
                <div class="runner-decision">
                    <label>${batterEntry.name} (Batter)</label>
                    <select data-from="0" data-player="${batterEntry.playerId}" data-is-batter="true">
                        ${batterOptions}
                    </select>
                </div>
            `;
        }

        decisions.innerHTML = html;
        modal.style.display = 'flex';

        document.getElementById('btn-confirm-runners').onclick = () => {
            const selects = decisions.querySelectorAll('select');
            const results = [];
            selects.forEach(sel => {
                const isBatter = sel.dataset.isBatter === 'true';
                if (isBatter) {
                    const val = sel.value;
                    if (val === 'out') {
                        results.push({ fromBase: 0, playerId: sel.dataset.player, toBase: 'out' });
                    } else {
                        const base = parseInt(val);
                        results.push({ fromBase: 0, playerId: sel.dataset.player, toBase: base });
                    }
                    return;
                }
                const val = sel.value;
                const toBase = val === 'home' ? 'home' : val === 'out' ? 'out' : parseInt(val);
                const fromBase = parseInt(sel.dataset.from);
                // Only add if runner actually moves or is out
                if (toBase !== fromBase) {
                    results.push({ fromBase, playerId: sel.dataset.player, toBase });
                }
            });
            modal.style.display = 'none';
            Game.recordAtBat(outcome, results);
            renderLiveGame();
        };
    }

    // Fielding Panel
    function renderFieldingPanel() {
        const s = Game.state.oppInningStats;
        document.getElementById('opp-runs-count').textContent = s.runs;
        document.getElementById('opp-walks-count').textContent = s.walks;
        document.getElementById('opp-ks-count').textContent = s.ks;
    }

    document.querySelectorAll('.counter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const stat = btn.dataset.stat;
            const isPlus = btn.classList.contains('plus');
            const key = stat.replace('opp-', '');
            if (isPlus) {
                Game.state.oppInningStats[key]++;
            } else {
                Game.state.oppInningStats[key] = Math.max(0, Game.state.oppInningStats[key] - 1);
            }
            Game.save();
            renderFieldingPanel();
        });
    });

    document.getElementById('btn-end-opp-inning').addEventListener('click', () => {
        Game.endOppHalf();
        renderLiveGame();
    });

    // Half-inning toggle (manual switch for corrections)
    document.querySelectorAll('#half-inning-toggle .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            Game.state.half = btn.dataset.half;
            Game.save();
            renderLiveGame();
        });
    });

    // Undo
    document.getElementById('btn-undo').addEventListener('click', () => {
        if (Game.undo()) renderLiveGame();
        else alert('Nothing to undo');
    });

    // End Game
    document.getElementById('btn-end-game').addEventListener('click', () => {
        if (confirm('End game and save stats?')) {
            Game.endGame();
            showView('home');
        }
    });

    // Init
    renderHome();

    // Stats management
    function renderGameHistory() {
        const games = Data.getGames();
        const container = document.getElementById('game-history-list');
        if (games.length === 0) {
            container.innerHTML = '<p style="color:var(--text-dim);text-align:center;">No games yet.</p>';
            return;
        }
        container.innerHTML = games.map((g, i) => {
            const date = new Date(g.date).toLocaleDateString();
            const result = g.teamScore > g.oppScore ? 'W' : g.teamScore < g.oppScore ? 'L' : 'T';
            const oppLabel = g.oppName || 'Opponent';
            return `
                <div class="game-history-item">
                    <span class="game-history-info">
                        <span class="game-result ${result}">${result}</span>
                        ${g.teamScore}–${g.oppScore} vs ${oppLabel} (${g.innings} inn) — ${date}
                    </span>
                    <button class="btn-remove" data-game-idx="${i}">×</button>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Delete this game?')) {
                    Data.deleteGame(parseInt(btn.dataset.gameIdx));
                    Stats.renderStatsTable('stats-table-container');
                    renderGameHistory();
                }
            });
        });
    }

    document.getElementById('btn-clear-all').addEventListener('click', () => {
        if (confirm('Erase ALL game data? This cannot be undone.')) {
            Data.clearAllGames();
            Stats.renderStatsTable('stats-table-container');
            renderGameHistory();
        }
    });
});
