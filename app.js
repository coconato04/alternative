/* YouTube Lite v2 — Legacy JS (ES5)
 * Compatible with older browsers/devices (no optional chaining, arrow fn, or fetch).
 * Requires config.js with window.YT_CONFIG = { API_KEY: "...", REGION: "ID" }.
 */

// ---- Config ----
var API_KEY = (window.YT_CONFIG && window.YT_CONFIG.API_KEY) ? window.YT_CONFIG.API_KEY : "";
var REGION = (window.YT_CONFIG && window.YT_CONFIG.REGION) ? window.YT_CONFIG.REGION : "ID";
var API_BASE = "https://www.googleapis.com/youtube/v3";

// ---- DOM helpers ----
function $(sel, el) { return (el || document).querySelector(sel); }

function $all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

// Elements
var sidebarEl = $("#sidebar");
var menuBtn = $("#menuBtn");
var searchForm = $("#searchForm");
var searchInput = $("#searchInput");

var feedEl = $("#feed");
var resultsEl = $("#results");
var filtersEl = $("#filters");
var orderSel = $("#orderSelect");
var safeSel = $("#safeSelect");
var applyBtn = $("#applyFilters");
var pagerEl = $("#pager");
var loadMoreBtn = $("#loadMore");

var watchEl = $("#watch");
var playerEl = $("#player");

// App state
var state = {
    route: "home",
    search: { q: "", order: "relevance", safe: "none", nextPageToken: null, lastQueryKey: "" }
};

// ---- Event listeners ----
if (menuBtn) {
    menuBtn.addEventListener("click", function() {
        var hidden = sidebarEl.classList.toggle("hidden");
        var app = document.getElementById("app");
        app.style.marginLeft = hidden ? "0" : "220px";
    });
}

if (searchForm) {
    searchForm.addEventListener("submit", function(e) {
        e.preventDefault();
        var q = searchInput.value.replace(/^\s+|\s+$/g, "");
        if (q) goToSearch(q, { reset: true });
    });
}

if (applyBtn) {
    applyBtn.addEventListener("click", function() {
        if (state.route !== "search" || !state.search.q) return;
        state.search.order = orderSel.value;
        state.search.safe = safeSel.value;
        doSearch({ reset: true });
    });
}

window.addEventListener("hashchange", router);
document.addEventListener("DOMContentLoaded", function() {
    if (!API_KEY) console.warn("Please set your API key in config.js");
    router();
});

// ---- Router ----
function router() {
    var hash = window.location.hash || "#home";
    var parts = hash.split("?");
    var path = parts[0];
    var qs = parts[1] || "";
    var params = parseParams(qs);

    if (path.indexOf("#watch") === 0) {
        var v = params.v;
        if (v) showWatch(v);
        else goHome();
    } else if (path.indexOf("#search") === 0) {
        var q = params.q || "";
        if (q) {
            searchInput.value = q;
            orderSel.value = params.order || state.search.order || "relevance";
            safeSel.value = params.safe || state.search.safe || "none";
            state.search.order = orderSel.value;
            state.search.safe = safeSel.value;
            goToSearch(q, { reset: true, push: false });
        } else {
            goHome();
        }
    } else {
        goHome();
    }
}

function goHome() {
    state.route = "home";
    filtersEl.classList.add("hidden");
    resultsEl.classList.add("hidden");
    pagerEl.classList.add("hidden");
    watchEl.classList.add("hidden");
    feedEl.classList.remove("hidden");
    loadMostPopular();
}

function goToSearch(q, opts) {
    opts = opts || {};
    var reset = (typeof opts.reset === "boolean") ? opts.reset : true;
    var push = (typeof opts.push === "boolean") ? opts.push : true;

    state.route = "search";
    if (reset) {
        state.search = { q: q, order: orderSel.value, safe: safeSel.value, nextPageToken: null, lastQueryKey: "" };
        resultsEl.innerHTML = "";
    } else {
        state.search.q = q;
    }
    filtersEl.classList.remove("hidden");
    feedEl.classList.add("hidden");
    watchEl.classList.add("hidden");
    resultsEl.classList.remove("hidden");
    pagerEl.classList.remove("hidden");

    if (push) {
        var url = "#search?q=" + encodeURIComponent(q) + "&order=" + encodeURIComponent(state.search.order) + "&safe=" + encodeURIComponent(state.search.safe);
        window.location.hash = url;
    }
    doSearch({ reset: reset });
}

if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", function() {
        if (state.route === "search") doSearch({ reset: false });
    });
}

// ---- API helpers (XMLHttpRequest) ----
function xhrJSON(url, cb) {
    try {
        var x = new XMLHttpRequest();
        x.open("GET", url, true);
        x.onreadystatechange = function() {
            if (x.readyState === 4) {
                if (x.status >= 200 && x.status < 300) {
                    try {
                        var data = JSON.parse(x.responseText);
                        cb(null, data);
                    } catch (e) {
                        cb(new Error("JSON parse error: " + e.message));
                    }
                } else {
                    cb(new Error("HTTP " + x.status + " " + (x.responseText || "")));
                }
            }
        };
        x.send();
    } catch (err) {
        cb(err);
    }
}

function yt(endpoint, params, cb) {
    var url = API_BASE + "/" + endpoint + "?" + toQueryString(merge(params, { key: API_KEY }));
    xhrJSON(url, cb);
}

function loadMostPopular() {
    feedEl.innerHTML = "<p style='opacity:.7'>Loading most popular…</p>";
    yt("videos", {
        part: "snippet,contentDetails,statistics",
        chart: "mostPopular",
        regionCode: REGION,
        maxResults: 24
    }, function(err, data) {
        if (err) { feedEl.innerHTML = errorBox(err); return; }
        var items = (data && data.items) ? data.items : [];
        var channelIds = unique(items.map(function(v) { return v.snippet && v.snippet.channelId; }).filter(Boolean));
        fetchChannels(channelIds, function(err2, channels) {
            if (err2) { feedEl.innerHTML = errorBox(err2); return; }
            renderGrid(feedEl, items.map(function(v) { return mapVideo(v, channels); }));
        });
    });
}

function doSearch(opts) {
    opts = opts || {};
    var reset = (typeof opts.reset === "boolean") ? opts.reset : false;

    var q = state.search.q,
        order = state.search.order,
        safe = state.search.safe;
    var pageToken = reset ? "" : (state.search.nextPageToken || "");

    var queryKey = [q, order, safe].join("|");
    var isNewQuery = state.search.lastQueryKey !== queryKey;

    if (reset || isNewQuery) {
        resultsEl.innerHTML = "";
        state.search.nextPageToken = null;
        state.search.lastQueryKey = queryKey;
    }

    var banner = document.createElement("p");
    banner.style.opacity = ".7";
    banner.textContent = (reset || isNewQuery) ? ("Searching “" + q + "”…") : "Loading more…";
    if (reset || isNewQuery) resultsEl.innerHTML = "";
    resultsEl.appendChild(banner);
    pagerEl.classList.add("hidden");

    yt("search", {
        part: "snippet",
        q: q,
        type: "video",
        regionCode: REGION,
        maxResults: 25,
        order: order,
        safeSearch: safe,
        pageToken: pageToken
    }, function(err, s) {
        if (err) { resultsEl.innerHTML = errorBox(err); return; }

        state.search.nextPageToken = (s && s.nextPageToken) ? s.nextPageToken : null;

        var ids = ((s && s.items) ? s.items : []).map(function(x) { return x.id && x.id.videoId; }).filter(Boolean);
        if (!ids.length) { resultsEl.innerHTML = '<p style="opacity:.7">No results for “' + escapeHtml(q) + '”.</p>'; return; }

        yt("videos", {
            part: "snippet,statistics,contentDetails",
            id: ids.join(","),
            maxResults: ids.length
        }, function(err2, vdata) {
            if (err2) { resultsEl.innerHTML = errorBox(err2); return; }
            var items = (vdata && vdata.items) ? vdata.items : [];
            var channelIds = unique(items.map(function(v) { return v.snippet && v.snippet.channelId; }).filter(Boolean));
            fetchChannels(channelIds, function(err3, channels) {
                if (err3) { resultsEl.innerHTML = errorBox(err3); return; }
                try { banner.parentNode.removeChild(banner); } catch (e) {}
                renderGrid(resultsEl, items.map(function(v) { return mapVideo(v, channels); }));
                if (state.search.nextPageToken) pagerEl.classList.remove("hidden");
                else pagerEl.classList.add("hidden");
            });
        });
    });
}

function fetchChannels(ids, cb) {
    if (!ids || !ids.length) { cb(null, {}); return; }
    var out = {};
    var i = 0;

    function next() {
        if (i >= ids.length) { cb(null, out); return; }
        var chunk = ids.slice(i, i + 50);
        i += 50;
        yt("channels", {
            part: "snippet",
            id: chunk.join(","),
            maxResults: 50
        }, function(err, data) {
            if (err) { cb(err); return; }
            var arr = (data && data.items) ? data.items : [];
            for (var j = 0; j < arr.length; j++) {
                var c = arr[j];
                out[c.id] = c;
            }
            next();
        });
    }
    next();
}

function mapVideo(v, channels) {
    var chId = v.snippet ? v.snippet.channelId : null;
    var ch = channels[chId];
    var channelIcon = "";
    if (ch && ch.snippet && ch.snippet.thumbnails && ch.snippet.thumbnails["default"]) {
        channelIcon = ch.snippet.thumbnails["default"].url;
    }
    var thumb = (v.snippet && v.snippet.thumbnails && (v.snippet.thumbnails.medium || v.snippet.thumbnails["default"])) ?
        (v.snippet.thumbnails.medium ? v.snippet.thumbnails.medium.url : v.snippet.thumbnails["default"].url) :
        "";
    return {
        id: (v.id && v.id.videoId) ? v.id.videoId : v.id,
        title: v.snippet ? v.snippet.title : "",
        thumb: thumb,
        duration: parseISODuration(v.contentDetails ? v.contentDetails.duration : ""),
        channelTitle: v.snippet ? v.snippet.channelTitle : "",
        channelIcon: channelIcon,
        views: (v.statistics ? v.statistics.viewCount : 0),
        publishedAt: (v.snippet ? v.snippet.publishedAt : "")
    };
}

function renderGrid(container, items) {
    var tpl = $("#cardTemplate");
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var node = document.importNode(tpl.content, true);

        var link = $(".thumb-link", node);
        var img = $(".thumb", node);
        var dur = $(".duration", node);
        var title = $(".title", node);
        var avatar = $(".avatar", node);
        var channel = $(".channel", node);
        var stats = $(".stats", node);

        link.setAttribute("href", "#watch?v=" + encodeURIComponent(it.id));
        img.setAttribute("src", it.thumb || "");
        img.setAttribute("alt", it.title || "");
        dur.textContent = it.duration || "";

        title.textContent = it.title || "";
        title.setAttribute("href", "#watch?v=" + encodeURIComponent(it.id));

        channel.textContent = it.channelTitle || "";
        if (it.channelIcon) avatar.setAttribute("src", it.channelIcon);

        stats.textContent = [fmtViews(it.views), timeAgo(it.publishedAt)].filter(Boolean).join(" • ");
        container.appendChild(node);
    }
}

// ---- Watch page ----
function showWatch(videoId) {
    state.route = "watch";
    feedEl.classList.add("hidden");
    resultsEl.classList.add("hidden");
    filtersEl.classList.add("hidden");
    pagerEl.classList.add("hidden");
    watchEl.classList.remove("hidden");

    playerEl.setAttribute("src", "https://www.youtube.com/embed/" + encodeURIComponent(videoId) + "?autoplay=1&rel=0");
    $("#videoTitle").textContent = "Loading…";
    $("#videoMeta").textContent = "";
    $("#videoDesc").textContent = "";
    $("#related").innerHTML = "";

    yt("videos", { part: "snippet,statistics,contentDetails", id: videoId }, function(err, data) {
        if (err) {
            $("#videoTitle").textContent = "Cannot load video";
            $("#videoMeta").innerHTML = errorBox(err);
            return;
        }
        var v = (data && data.items && data.items[0]) ? data.items[0] : null;
        if (!v) {
            $("#videoTitle").textContent = "Video not found";
            return;
        }
        $("#videoTitle").textContent = v.snippet.title || "";
        $("#videoMeta").textContent = [v.snippet.channelTitle, fmtViews(v.statistics ? v.statistics.viewCount : 0), timeAgo(v.snippet.publishedAt)].filter(Boolean).join(" • ");
        $("#videoDesc").textContent = v.snippet.description || "";

        yt("search", { part: "snippet", type: "video", relatedToVideoId: videoId, maxResults: 12 }, function(err2, rel) {
            if (err2) return;
            var ids = ((rel && rel.items) ? rel.items : []).map(function(x) { return x.id && x.id.videoId; }).filter(Boolean);
            yt("videos", { part: "snippet,statistics,contentDetails", id: ids.join(","), maxResults: ids.length }, function(err3, vdata) {
                if (err3) return;
                var items = (vdata && vdata.items) ? vdata.items : [];
                var channelIds = unique(items.map(function(v) { return v.snippet && v.snippet.channelId; }).filter(Boolean));
                fetchChannels(channelIds, function(err4, channels) {
                    if (err4) return;
                    renderRelated(items.map(function(v) { return mapVideo(v, channels); }));
                });
            });
        });
    });
}

function renderRelated(items) {
    var rel = $("#related");
    rel.innerHTML = "";
    var tpl = $("#cardTemplate");
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var node = document.importNode(tpl.content, true);
        $(".thumb-link", node).setAttribute("href", "#watch?v=" + encodeURIComponent(it.id));
        $(".thumb", node).setAttribute("src", it.thumb || "");
        $(".title", node).textContent = it.title || "";
        $(".title", node).setAttribute("href", "#watch?v=" + encodeURIComponent(it.id));
        if (it.channelIcon) $(".avatar", node).setAttribute("src", it.channelIcon);
        $(".channel", node).textContent = it.channelTitle || "";
        $(".stats", node).textContent = [fmtViews(it.views), timeAgo(it.publishedAt)].join(" • ");
        rel.appendChild(node);
    }
}

// ---- Utils ----
function parseParams(qs) {
    var obj = {};
    if (!qs) return obj;
    var parts = qs.split("&");
    for (var i = 0; i < parts.length; i++) {
        var kv = parts[i].split("=");
        var k = decodeURIComponent(kv[0] || "");
        var v = decodeURIComponent(kv[1] || "");
        obj[k] = v;
    }
    return obj;
}

function toQueryString(params) {
    var arr = [];
    for (var k in params)
        if (params.hasOwnProperty(k) && params[k] !== undefined && params[k] !== null) {
            arr.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
        }
    return arr.join("&");
}

function merge(a, b) {
    var o = {};
    var k;
    for (k in a)
        if (a.hasOwnProperty(k)) o[k] = a[k];
    for (k in b)
        if (b.hasOwnProperty(k)) o[k] = b[k];
    return o;
}

function unique(arr) {
    var out = [],
        seen = {};
    for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (!seen[v]) { seen[v] = 1;
            out.push(v); } }
    return out;
}

function timeAgo(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var diff = (new Date().getTime() - d.getTime()) / 1000;
    var units = [
        ["year", 365 * 24 * 3600],
        ["month", 30 * 24 * 3600],
        ["week", 7 * 24 * 3600],
        ["day", 24 * 3600],
        ["hour", 3600],
        ["minute", 60]
    ];
    for (var i = 0; i < units.length; i++) {
        var s = units[i][1];
        var n = Math.floor(diff / s);
        if (n >= 1) return n + " " + units[i][0] + (n > 1 ? "s" : "") + " ago";
    }
    return "just now";
}

function fmtViews(n) {
    n = Number(n || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B views";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M views";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K views";
    return n + " views";
}

function parseISODuration(iso) {
    if (!iso) return "";
    var m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return "";
    var h = parseInt(m[1] || "0", 10);
    var mi = parseInt(m[2] || "0", 10);
    var s = parseInt(m[3] || "0", 10);
    var total = h * 3600 + mi * 60 + s;
    var hh = Math.floor(total / 3600);
    var mm = Math.floor((total % 3600) / 60);
    var ss = total % 60;
    if (hh > 0) return String(hh) + ":" + ("0" + mm).slice(-2) + ":" + ("0" + ss).slice(-2);
    return String(mm) + ":" + ("0" + ss).slice(-2);
}

function escapeHtml(s) {
    s = s || "";
    return s.replace(/[&<>"']/g, function(m) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[m];
    });
}

function errorBox(err) {
    var msg = (err && err.message) ? err.message : String(err);
    return '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--card)">' +
        '<strong>Something went wrong</strong><br>' +
        '<span style="opacity:.8">' + escapeHtml(msg) + '</span></div>';
}