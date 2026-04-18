var __gameSearchCache = null;
var __searchScheduled = false;

function buildGameSearchCache() {
    var gameNodes = Array.from(document.getElementsByClassName('game-button'));
    __gameSearchCache = gameNodes.map(function(game) {
        var p = game.getElementsByTagName('p')[0];
        return {
            node: game,
            name: p ? p.textContent.toLowerCase() : ''
        };
    });
}

function runGameSearch(input) {
    if (!__gameSearchCache) {
        buildGameSearchCache();
    }

    var normalizedInput = (input || '').toLowerCase();
    __gameSearchCache.forEach(function(game) {
        game.node.style.display = game.name.includes(normalizedInput) ? '' : 'none';
    });
}

function searchGames() {
    var searchBar = document.getElementById('searchBar');
    var input = searchBar ? searchBar.value : '';

    if (__searchScheduled) return;
    __searchScheduled = true;

    requestAnimationFrame(function() {
        runGameSearch(input);
        __searchScheduled = false;
    });
}

function searchToGames() {
    var searchBar = document.getElementById('searchBar');
    if (!searchBar) return;
    var query = searchBar.value.trim();
    if (query) {
        window.location.href = '/s/games.html?search=' + encodeURIComponent(query);
    }
}

window.addEventListener('DOMContentLoaded', function() {
    buildGameSearchCache();

    var params = new URLSearchParams(window.location.search);
    var search = params.get('search');
    if (search) {
        var searchBar = document.getElementById('searchBar');
        if (searchBar) {
            searchBar.value = search;
            runGameSearch(search);
        }
    }
});