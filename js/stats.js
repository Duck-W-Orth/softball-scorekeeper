// stats.js — stat calculations

const Stats = {
    avg(s) { return s.ab > 0 ? (s.h / s.ab) : 0; },
    obp(s) {
        const denom = s.ab + s.bb + (s.sf || 0);
        return denom > 0 ? ((s.h + s.bb) / denom) : 0;
    },
    slg(s) {
        if (s.ab === 0) return 0;
        const tb = s.singles + (s.doubles * 2) + (s.triples * 3) + (s.hr * 4);
        return tb / s.ab;
    },
    ops(s) { return this.obp(s) + this.slg(s); },

    format(val) { return val.toFixed(3).replace(/^0/, ''); },

    renderStatsTable(containerId) {
        const allStats = Data.getAllPlayerStats();
        const container = document.getElementById(containerId);

        const players = Object.values(allStats).sort((a, b) => {
            const opsA = this.ops(a), opsB = this.ops(b);
            return opsB - opsA;
        });

        if (players.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-dim);">No games played yet.</p>';
            return;
        }

        let html = '<table class="stats-table"><thead><tr>';
        html += '<th>Player</th><th>G</th><th>PA</th><th>AB</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>RBI</th><th>R</th><th>BB</th><th>K</th><th>FO</th><th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th>';
        html += '</tr></thead><tbody>';

        players.forEach(s => {
            html += '<tr>';
            html += `<td>${s.number ? '#' + s.number + ' ' : ''}${s.name}</td>`;
            html += `<td>${s.games}</td>`;
            html += `<td>${s.pa}</td>`;
            html += `<td>${s.ab}</td>`;
            html += `<td>${s.h}</td>`;
            html += `<td>${s.doubles}</td>`;
            html += `<td>${s.triples}</td>`;
            html += `<td>${s.hr}</td>`;
            html += `<td>${s.rbi}</td>`;
            html += `<td>${s.r}</td>`;
            html += `<td>${s.bb}</td>`;
            html += `<td>${s.k}</td>`;
            html += `<td>${s.foulOut}</td>`;
            html += `<td>${this.format(this.avg(s))}</td>`;
            html += `<td>${this.format(this.obp(s))}</td>`;
            html += `<td>${this.format(this.slg(s))}</td>`;
            html += `<td>${this.format(this.ops(s))}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }
};
