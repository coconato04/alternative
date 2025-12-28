var API_KEY = window.YT_CONFIG && window.YT_CONFIG.API_KEY ? window.YT_CONFIG.API_KEY : "";
var REGION = window.YT_CONFIG && window.YT_CONFIG.REGION ? window.YT_CONFIG.REGION : "ID";
var API_BASE = "https://www.googleapis.com/youtube/v3";

function $(s, e) { return (e || document).querySelector(s); }

var feedEl = $("#feed");
var resultsEl = $("#results");
var watchEl = $("#watch");
var playerHostEl = $("#playerHost");
var relatedEl = $("#related");
var pagerEl = $("#pager");
var loadMoreBtn = $("#loadMore");
var searchForm = $("#searchForm");
var searchInput = $("#searchInput");

var PRIVACY = {
    embedHost: "https://www.youtube-nocookie.com/embed/",
    clickToLoad: true
};

var state = {
    route: "home",
    search: { q: "", pageToken: null }
};

function xhrJSON(url, cb) {
    var x = new XMLHttpRequest();
    x.open("GET", url, true);
    x.onreadystatechange = function() {
        if (x.readyState === 4) {
            if (x.status >= 200 && x.status < 300) {
                try { cb(null, JSON.parse(x.responseText)); } catch (e) { cb(e); }
            } else {
                cb(new Error("HTTP " + x.status));
            }
        }
    };
    x.send();
}

function yt(ep, params, cb) {
    var qs = [];
    for (var k in params) qs.push(k + "=" + encodeURIComponent(params[k]));
    qs.push("key=" + API_KEY);
    xhrJSON(API_BASE + "/" + ep + "?" + qs.join("&"), cb);
}

function clear() {
    feedEl.classList.add("hidden");
    resultsEl.classList.add("hidden");
    watchEl.classList.add("hidden");
    pagerEl.classList.add("hidden");
}

function router() {
    var h = location.hash || "#home";
    if (h.indexOf("#watch") === 0) {
        var id = h.split("v=")[1];
        if (id) showWatch(id);
        else goHome();
    } else if (h.indexOf("#search") === 0) {
        var q = decodeURIComponent((h.split("q=")[1] || "").split("&")[0]);
        if (q) goSearch(q, true);
        else goHome();
    } else {
        goHome();
    }
}

function goHome() {
    clear();
    feedEl.classList.remove("hidden");
    loadPopular();
}

function goSearch(q, reset) {
    clear();
    resultsEl.classList.remove("hidden");
    pagerEl.classList.remove("hidden");
    if (reset) {
        state.search.q = q;
        state.search.pageToken = null;
        resultsEl.innerHTML = "";
    }
    doSearch();
}

function loadPopular() {
    feedEl.innerHTML = "Loading…";
    yt("videos", {
        part: "snippet,statistics,contentDetails,status",
        chart: "mostPopular",
        regionCode: REGION,
        maxResults: 24
    }, function(e, d) {
        if (e) { feedEl.innerHTML = "Error"; return; }
        feedEl.innerHTML = "";
        renderCards(feedEl, d.items || []);
    });
}

function doSearch() {
    yt("search", {
        part: "snippet",
        q: state.search.q,
        type: "video",
        maxResults: 20,
        pageToken: state.search.pageToken || ""
    }, function(e, s) {
        if (e) return;
        state.search.pageToken = s.nextPageToken || null;
        var ids = [];
        for (var i = 0; i < s.items.length; i++) ids.push(s.items[i].id.videoId);
        yt("videos", {
            part: "snippet,statistics,contentDetails,status",
            id: ids.join(",")
        }, function(e2, v) {
            if (e2) return;
            renderCards(resultsEl, v.items || []);
            pagerEl.classList.toggle("hidden", !state.search.pageToken);
        });
    });
}

function showWatch(id) {
    clear();
    watchEl.classList.remove("hidden");
    relatedEl.innerHTML = "";
    playerHostEl.innerHTML = "";

    if (PRIVACY.clickToLoad) {
        var a = document.createElement("a");
        a.href = "#";
        a.textContent = "▶ Click to load video";
        a.onclick = function(e) {
            e.preventDefault();
            mountPlayer(id);
        };
        playerHostEl.appendChild(a);
    } else {
        mountPlayer(id);
    }

    yt("videos", {
        part: "snippet,statistics",
        id: id
    }, function(e, d) {
        if (e || !d.items || !d.items.length) return;
        $("#videoTitle").textContent = d.items[0].snippet.title;
        $("#videoMeta").textContent =
            d.items[0].snippet.channelTitle + " • " +
            fmtViews(d.items[0].statistics.viewCount);
        $("#videoDesc").textContent = d.items[0].snippet.description || "";
    });

    yt("search", {
        part: "snippet",
        relatedToVideoId: id,
        type: "video",
        maxResults: 12
    }, function(e, r) {
        if (e) return;
        var ids = [];
        for (var i = 0; i < r.items.length; i++) ids.push(r.items[i].id.videoId);
        yt("videos", {
            part: "snippet,statistics,contentDetails,status",
            id: ids.join(",")
        }, function(e2, v) {
            if (e2) return;
            renderCards(relatedEl, v.items || []);
        });
    });
}

function mountPlayer(id) {
    playerHostEl.innerHTML = "";
    var f = document.createElement("iframe");
    f.width = "100%";
    f.height = "100%";
    f.allow = "autoplay; encrypted-media; picture-in-picture";
    f.allowFullscreen = true;
    f.src = PRIVACY.embedHost + id + "?autoplay=1";
    playerHostEl.appendChild(f);
}

function renderCards(container, items) {
    var tpl = $("#cardTemplate");
    for (var i = 0; i < items.length; i++) {
        var v = items[i];
        if (!v.status || v.status.embeddable === false) continue;
        var n = document.importNode(tpl.content, true);
        $(".thumb", n).src = v.snippet.thumbnails.medium.url;
        $(".title", n).textContent = v.snippet.title;
        $(".title", n).href = "#watch?v=" + v.id;
        $(".thumb-link", n).href = "#watch?v=" + v.id;
        $(".channel", n).textContent = v.snippet.channelTitle;
        $(".stats", n).textContent = fmtViews(v.statistics.viewCount);
        container.appendChild(n);
    }
}

function fmtViews(n) {
    n = +n;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M views";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K views";
    return n + " views";
}

searchForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var q = searchInput.value.trim();
    if (!q) return;
    location.hash = "#search?q=" + encodeURIComponent(q);
});

loadMoreBtn.addEventListener("click", function() {
    if (state.search.q) doSearch();
});

window.addEventListener("hashchange", router);
document.addEventListener("DOMContentLoaded", router);