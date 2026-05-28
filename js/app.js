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

        if (name === 'stats') Stats.renderStatsTable('stats-table-container');
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
        document.getElementById('lineup-setup').style.display = 'block';
        document.getElementById('live-game').style.display = 'none';
        showView('game');
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
    }

    document.getElementById('btn-start-game').addEventListener('click', () => {
        Game.create(selectedLineup);
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

        document.getElementById('team-score').textContent = `Us: ${s.teamScore}`;
        document.getElementById('opp-score').textContent = `Them: ${s.oppScore}`;
        document.getElementById('inning-display').textContent = `Inn: ${s.half === 'top' ? '▲' : '▼'} ${s.inning}`;
        document.getElementById('outs-display').textContent = `Outs: ${s.outs}`;

        // Bases
        document.getElementById('base-1').classList.toggle('occupied', !!s.bases[0]);
        document.getElementById('base-2').classList.toggle('occupied', !!s.bases[1]);
        document.getElementById('base-3').classList.toggle('occupied', !!s.bases[2]);

        // Half toggle
        const toggleBtns = document.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-half="${s.half === 'top' ? 'top' : 'bottom'}"]`).classList.add('active');

        const battingPanel = document.getElementById('batting-panel');
        const fieldingPanel = document.getElementById('fielding-panel');

        if (s.half === 'top') {
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
            { label: 'HBP', outcome: 'HBP', cls: 'walk' },
            { label: 'K', outcome: 'K', cls: 'out' },
            { label: 'Foul Out', outcome: 'FO', cls: 'out' },
            { label: 'Ground Out', outcome: 'GO', cls: 'out' },
            { label: 'Fly Out', outcome: 'FLY', cls: 'out' },
            { label: 'Line Out', outcome: 'LO', cls: 'out' },
            { label: 'Sac Fly', outcome: 'SF', cls: 'out' },
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

        if (defaults.length === 0) {
            Game.recordAtBat(outcome, []);
            renderLiveGame();
            return;
        }

        const roster = Game.state.lineup;

        decisions.innerHTML = defaults.map(d => {
            const player = roster.find(p => p.id === d.playerId) || { name: 'Runner' };
            const baseLabel = d.fromBase === 1 ? '1st' : d.fromBase === 2 ? '2nd' : '3rd';

            let options = '';
            // Options depend on outcome type
            if (['GO', 'FLY', 'LO', 'SF'].includes(outcome)) {
                options = `
                    <option value="${d.fromBase}" ${d.fromBase === d.defaultTo ? 'selected' : ''}>Stays at ${baseLabel}</option>
                    ${d.fromBase < 3 ? `<option value="${d.fromBase + 1}">Advances to ${d.fromBase + 1 === 2 ? '2nd' : '3rd'}</option>` : ''}
                    <option value="home" ${d.defaultTo === 'home' ? 'selected' : ''}>Scores</option>
                    <option value="out" ${d.defaultTo === 'out' ? 'selected' : ''}>Out</option>
                `;
            } else {
                options = `
                    <option value="${d.fromBase}">Stays at ${baseLabel}</option>
                    ${d.fromBase < 3 ? `<option value="${d.fromBase + 1}" ${d.defaultTo === d.fromBase + 1 ? 'selected' : ''}>Advances to ${d.fromBase + 1 === 2 ? '2nd' : '3rd'}</option>` : ''}
                    <option value="home" ${d.defaultTo === 'home' ? 'selected' : ''}>Scores</option>
                `;
                // For walks/HBP, force advance is default
                if (['BB', 'HBP'].includes(outcome)) {
                    options = `
                        <option value="${d.fromBase}">Stays at ${baseLabel}</option>
                        <option value="${d.fromBase + 1 <= 3 ? d.fromBase + 1 : 'home'}" ${d.defaultTo === d.fromBase + 1 || (d.fromBase === 3 && d.defaultTo === 'home') ? 'selected' : ''}>Advances to ${d.fromBase + 1 <= 3 ? (d.fromBase + 1 === 2 ? '2nd' : '3rd') : 'Home'}</option>
                        <option value="home" ${d.defaultTo === 'home' && d.fromBase < 3 ? 'selected' : ''}>Scores</option>
                    `;
                }
            }

            return `
                <div class="runner-decision">
                    <label>${player.name} (on ${baseLabel})</label>
                    <select data-from="${d.fromBase}" data-player="${d.playerId}">
                        ${options}
                    </select>
                </div>
            `;
        }).join('');

        modal.style.display = 'flex';

        document.getElementById('btn-confirm-runners').onclick = () => {
            const selects = decisions.querySelectorAll('select');
            const results = [];
            selects.forEach(sel => {
                const val = sel.value;
                const toBase = val === 'home' ? 'home' : val === 'out' ? 'out' : parseInt(val);
                const fromBase = parseInt(sel.dataset.from);
                // Only add if runner actually moves
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
        if (Game.state.gameOver) {
            Game.endGame();
            showView('home');
            alert('Game over! Stats saved.');
        } else {
            renderLiveGame();
        }
    });

    // Half-inning toggle (manual switch for corrections)
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.half === 'top') {
                Game.state.half = 'top';
            } else {
                Game.state.half = 'bottom';
            }
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
});
