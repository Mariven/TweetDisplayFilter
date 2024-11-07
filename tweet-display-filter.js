// ==UserScript==
// @name         Tweet Display Filter
// @author       Mariven
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Apply custom CSS to tweets based on their data
// @match        *://x.com/*
// @grant        none
// ==/UserScript==

const MAX_CACHE_SIZE = 1000;
const collapse = (fn) => (a, b=null) => b===null ? fn(a) : fn(a)(b);
const id = (x) => x;

function getItem(arr, idx) {
	if (typeof arr === "string") {
		return getItem(arr.split(''), idx);
	}
	if (idx < 0) {
		idx = arr.length + idx;
	}
	if (arr.length === 0 || idx < 0 || idx >= arr.length) {
		return null;
	}
	return arr[idx];
}

const apply = collapse((fn) => (arg) => fn(arg));
const applyTo = collapse((arg) => (fn) => fn(arg));
const map = collapse((fn) => (arr) => arr?.map !== null ? arr.map(fn) : fn(arr));
const filter = collapse((fn) => (arr) => arr.filter(fn));

const objectify = collapse(
	(defaultObj) => (objfn) =>
		Object.assign(objfn, objfn(defaultObj))
);

const Dom = objectify(
	document,
	(el) => ({
		get: (sel) => el.querySelector(sel),
		all: (sel) => Array.from(el.querySelectorAll(sel)),
		id: (id) => el.getElementById(id)
	})
);
/* Example uses of Dom
	Dom.get('article'); // first article in document
	Dom.id('bluetext'); // element with id 'bluetext'
	Dom(element).get('a'); // first link in element
	Dom(element).all('span'); // all spans in element
*/

const Text = objectify(
	document,
	(el) => ({
		get: (sel) => el?.querySelector(sel)?.innerText,
		all: (sel) => Array.from(el.querySelectorAll(sel)).map(e => e.innerText),
		allSet: (sel) => {
			const r = [];
			for(let e of Array.from(el.querySelectorAll(sel)).map(e => e.innerText))
				if(e?.length > 0 && !r.includes(e))
					r.push(e);
			return r;
		},
		id: (id) => el.getElementById(id).innerText,
	})
);

function countAsNum(s) {
    s = s.trim().replace(/,/g, '');
	if (s.match(/^[0-9]*$/)) {
		return parseInt(s || "0");
	}
	if (s.match(/^[0-9\.]+[KMG]$/)) {
        let size = s.slice(-1), num = parseFloat(s.slice(0,-1));
        return num * ({K: 1000, M: 1000000, G: 1000000000}[size]);
    }
    return false;
}

function getRepostData(article, iconLabels) {
	let reposted = {};
	if (iconLabels.length && iconLabels[0].includes("reposted")) {
		reposted.name = iconLabels[0].split(" reposted")[0];
		reposted.id = "@" + Dom(article).all("div:has(>div>svg):first-child a[href^='/']")[0].getAttribute('href').slice(1);
	}
	return reposted != {} ? reposted : null;
}

function getStats(article, iconLabels) {
	let stats = {};
	// let interactions = Text(article).all(":is(button,a):has(>div>div>svg):is([aria-label*='.'])").map(countAsNum);
	[
        ["replies", "[data-testid$='reply']"],
        ["retweets", "[data-testid$='retweet']"],
        ["likes", "[data-testid$='like']"],
        ["views", "[href$='analytics']"]
    ].forEach(([name, sel]) => {
        stats[name] = Text(article).all(sel + " span:not(:has(*))").map(countAsNum)[0]
    });
	// if (!interactions || interactions.length == 0) {
	// 	return null;
	// }
	// interactions = interactions.filter(x=>x!==null);
	// if (interactions.length !== 4) {
	// 	return null;
	// }
	// stats.replies = interactions[0];
	// stats.retweets = interactions[1];
	// stats.likes = interactions[2];
	// stats.views = interactions[3];
	return stats;
}

function getContent(article, iconLabels) {
    let content = { author: {}, quote: {} };
    let text = Text(article).all("[data-testid$='tweetText']");
    if (text.length === 0) {
        content.text = Text(article).get("div[lang]")?.innerText;
    } else {
        content.text = text[0];
    }
    if (text.length > 1) { // the second one is a quoted tweet
        content.quote.text = text[1];
    }
    let userLine = Dom(article).all("[data-testid$='User-Name']");
    if (userLine.length != 0) {
        //content.author.id = "@" + Dom(userLine[0]).get("a[href^='/']")?.getAttribute("href")?.slice(1);
        content.author.id = userLine[0]?.innerText.split("\n")[1];
        content.author.name = userLine[0]?.innerText.split("\n")[0];
        if (Dom(userLine[0]).get("[data-testid*='verified']")) {
            content.author.verified = true;
        }
    }
    if (content.quote.text && userLine.length > 1) {
        content.quote.author = {};
        //content.quote.author.id = "@" + Dom(userLine[1]).get("a[href^='/']")?.getAttribute("href")?.slice(1);
        content.quote.author.id = userLine[1]?.innerText.split("\n")[1];
        content.quote.author.name = userLine[1]?.innerText.split("\n")[0];
        if (Dom(userLine[1]).get("[data-testid*='verified']")) {
            content.quote.author.verified = true;
        }
    }

    let date = Text(article).all("time");
    if (date.length > 0) {
        content.date = date[0];
    }
    if (content.quote.text && date.length > 1) {
        content.quote.date = date[1];
    }
	// let lines = Text(article).allSet("div:not(:has(svg))");
	// lines = lines.filter(x=>!iconLabels.includes(x)).filter(x=>(!x.includes("\n") || !(isSubarray(x.split("\n"), lines))));
	// content.author = {name: lines[0], id: lines.filter(x=>x.match(/^@.*/))[0]};
	// content.date = lines.filter((x)=>x.match(/^([A-Z][a-z]+ [0-9]+|[0-9]+[smhd])$/))[0];
	// content.text = lines[lines.indexOf(content.date) + 1];
	return content;
}

function getId(article) {
	let strings = Dom(article).get("a[href*='/status/']").getAttribute("href").match(/[0-9]+$/);
	if (strings.length > 0) {
		return parseInt(strings[0]);
	}
	return null;
}

function getImages(article, iconlabels) {
    let images = Array.from(article.querySelectorAll("img"))
        .map(x=>x.getAttribute("src"))
        .filter(x=>x.match(/https:\/\/pbs.twimg.com\/(media|[^/]*?video_thumb)\//));
    return images;
}

function getTweetData(article, cache = {}, tweetRulesManager = null) {
    if (!article) return null;
    let data = {};
    let iconLabels = Text(article).allSet("div:has(>div>svg)");
    try {
        data.id = getId(article);
        data.images = getImages(article, iconLabels) || [];
    } catch(error) {
        // console.error('Error parsing article: ', error);
        return null;
    }
    try {
        if (!cache[data.id]) {
            data.repost = getRepostData(article, iconLabels);
            data.stats = getStats(article, iconLabels) || {};
            data.content = getContent(article, iconLabels) || {};
            cache[data.id] = data;
			console.log(data);
        } else {
            if (data.images.length > cache[data.id].images.length) {
                cache[data.id].images = data.images;
                console.log("Added image data for tweet with id " + data.id);
            }
            data = cache[data.id];
        }
    } catch(error) {
        console.error(`Error parsing article with id ${data.id}: `, error);
        return null;
    }
    if (data && Object.keys(data).length !== 0) {
        const applicableClasses = tweetRulesManager.rules
            .filter(rule => tweetRulesManager.evaluateRule(rule, data))
            .flatMap(rule => rule.classes.split(',').map(c => c.trim()).filter(c => c));
        if(applicableClasses.length > 0) {
            article.classList.add(...applicableClasses);
        }
    }
}

function isSubarray(A0, A, consecutive = false) {
	if (A0.length == 0 || A0.length == 1 && A.includes(A0[0])) {
		return true;
	}
	let indices = A0.map(x=>A.indexOf(x));
	let i = -1;
	for (let idx of indices) {
		if (idx - i <= 0 || consecutive && idx - i > 1) {
			return false
		}
	}
	return true;
}


const MENU_HTML = `
<div id="tweet-rules-menu" class="tweet-rules-menu hidden">
    <div class="menu-header">
        <h3>Tweet Style Rules</h3>
        <button id="toggle-menu" class="toggle-btn">Show</button>
    </div>
    <div class="menu-content">
        <div class="section">
            <h4>CSS Classes</h4>
            <div class="table-header class-header">
                <span>Class Name</span>
                <span>CSS Properties</span>
                <span></span>
            </div>
            <div id="classes-container"></div>
            <button id="add-class" class="add-btn">+ Class</button>
        </div>
        <div class="section">
            <h4>Rules</h4>
            <div class="table-header rule-header">
                <span>Field</span>
                <span>Relation</span>
                <span>Argument</span>
                <span>Classes</span>
                <span>Enable</span>
                <span></span>
            </div>
            <div id="rules-container"></div>
            <button id="add-rule" class="add-btn">+ Rule</button>
        </div>
    </div>
</div>
`;

const MENU_CSS = `
.tweet-rules-menu {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 15px;
    z-index: 10000;
    max-height: 80vh;
    width: 400px;
	height: auto;
	overflow: auto;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    transition: opacity 0.1s;
}

.tweet-rules-menu h4 {
	margin: 0px;
}

.menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
	padding: 5px;
}

.section {
	padding: 5px;
}

.menu-header h3 {
    margin: 0;
}

.tweet-rules-menu.hidden {
    opacity: 0.5;
}

.tweet-rules-menu.hidden:hover {
    opacity: 0.8;
}

.tweet-rules-menu.hidden .menu-content {
    display: none;
}
.add-btn, .delete-btn {
    font-size: 14px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.add-btn {
    background-color: #1da1f2;
    color: #fff;
}

.add-btn:hover {
    background-color: #1991db;
}

.delete-btn {
    background-color: #ff4d4d;
    color: #fff;
}

.delete-btn:hover {
    background-color: #ff1a1a;
}

.toggle-btn {
    background-color: transparent;
    border: none;
    font-size: 16px;
    cursor: pointer;
}

.toggle-btn:hover {
    color: #1da1f2;
}

.table-header {
    display: flex;
    align-items: center;
    font-weight: bold;
    border-bottom: 1px solid #ccc;
    padding-bottom: 5px;
	font-size: 12px;
}

.table-header span {
    margin-right: 5px;
}

.class-row, .rule-row {
    display: flex;
    align-items: center;
}

.class-row input, .rule-row input, .rule-row select {
    margin-right: 5px;
}

.class-name {
    width: 75px;
}

.class-css {
    flex: 1;
}

.rule-row select, .rule-row input {
    width: 75px;
}

.rule-row input[type="text"] {
    width: 75px;
}

.rule-row input[type="checkbox"] {
    width: auto;
}
.class-header span:nth-child(1) { width: 120px; }
.class-header span:nth-child(2) { flex-grow: 1; }
.class-header span:nth-child(3) { width: 40px; }

.rule-header span:nth-child(1) { width: 120px; }
.rule-header span:nth-child(2) { width: 120px; }
.rule-header span:nth-child(3) { width: 120px; }
.rule-header span:nth-child(4) { flex-grow: 1; }
.rule-header span:nth-child(5) { width: 60px; text-align: center; }
.rule-header span:nth-child(6) { width: 40px; }

select {
    height: 20px;
	flex: 1;
    margin-right: 5px;
    font-size: 12px;
}

input[type="checkbox"] {
    width: 10px;
    height: 10px;
    margin: 0 auto;
    display: block;
}

input {
    flex: 1;
    margin-right: 5px;
    font-size: 12px;
}

.rule-row, .class-row {
    flex-wrap: wrap;
}
`;

const FIELD_OPTIONS = [
    "name",
    "id",
    "verified",
    "views",
    "likes",
    "retweets",
    "replies",
    "text",
    "date",
	"images",
	"reposter name",
	"reposter id",
	"quoted name",
	"quoted id",
	"quoted text",
	"quoted date",
	"quoted verified",
];

const RELATION_OPTIONS = [
	"contains",
    "doesn't contain",
    "equals",
    "doesn't equal",
    "at least",
    "at most",
	"is nonempty",
	"is empty",
	"is true",
	"is false",
];

class TweetRulesManager {
    constructor() {
        this.classes = [];
        this.rules = [];
        this.setupUI();
        this.loadFromStorage();
		this.renderUI();

    }

	setupUI() {
		const style = document.createElement('style');
		style.textContent = MENU_CSS;
		document.head.appendChild(style);

		const menuDiv = document.createElement('div');
		menuDiv.innerHTML = MENU_HTML;
		document.body.appendChild(menuDiv);

		document.getElementById('add-class').onclick = () => this.addClass();
		document.getElementById('add-rule').onclick = () => this.addRule();

		const toggleBtn = document.getElementById('toggle-menu');
		toggleBtn.addEventListener('click', () => {
			const menuContent = document.querySelector('.menu-content');
			if (menuContent) {
				menuContent.classList.toggle('hidden');
				toggleBtn.textContent = menuContent.classList.contains('hidden') ? 'Show' : 'Hide';
			}
		});

		this.renderUI();
	}

    addClass(name = '', css = '') {
        this.classes.push({ name, css });
        this.renderUI();
        this.saveToStorage();
    }

    addRule(field = FIELD_OPTIONS[0], relation = RELATION_OPTIONS[0], argument = '', classes = '', enabled = true) {
        this.rules.push({ field, relation, argument, classes, enabled });
        this.renderUI();
        this.saveToStorage();
    }

	updateClass(index, field, value) {
		this.classes[index][field] = value;
		this.saveToStorage();
		// No need to call renderUI here since inputs are already bound
		this.applyStyles();
	}

	updateRule(index, field, value, doRender = true) {
		this.rules[index][field] = value;
		this.saveToStorage();
		if(doRender) this.renderUI();
	}

	deleteClass(index) {
		this.classes.splice(index, 1);
		this.saveToStorage();
		this.renderUI();
		this.applyStyles();
	}

	deleteRule(index) {
		this.rules.splice(index, 1);
		this.saveToStorage();
		this.renderUI();
	}

	renderUI() {
		const classesContainer = document.getElementById('classes-container');
		const rulesContainer = document.getElementById('rules-container');

		classesContainer.innerHTML = '';
		rulesContainer.innerHTML = '';

		this.classes.forEach((cls, i) => {
			const classRow = document.createElement('div');
			classRow.className = 'class-row';
			classRow.innerHTML = `
				<input type="text" class="class-name" value="${cls.name}">
				<input type="text" class="class-css" value="${cls.css}">
				<button class="delete-btn">×</button>
			`;
			classRow.querySelector('.delete-btn').onclick = () => this.deleteClass(i);
			const inputs = classRow.querySelectorAll('input[type="text"]');
			inputs[0].oninput = (e) => this.updateClass(i, 'name', e.target.value);
			inputs[1].oninput = (e) => this.updateClass(i, 'css', e.target.value);
			classesContainer.appendChild(classRow);
		});

		this.rules.forEach((rule, i) => {
			const ruleRow = document.createElement('div');
			ruleRow.className = 'rule-row';
			ruleRow.innerHTML = `
				<select>
					${FIELD_OPTIONS.map(opt => `<option value="${opt}" ${rule.field === opt ? 'selected' : ''}>${opt}</option>`).join('')}
				</select>
				<select>
					${RELATION_OPTIONS.map(opt => `<option value="${opt}" ${rule.relation === opt ? 'selected' : ''}>${opt}</option>`).join('')}
				</select>
				<input type="text" value="${rule.argument}">
				<input type="text" value="${rule.classes}">
				<input type="checkbox" ${rule.enabled ? 'checked' : ''}>
				<button class="delete-btn">×</button>
			`;
			ruleRow.querySelector('.delete-btn').onclick = () => this.deleteRule(i);
			const selectors = ruleRow.querySelectorAll('select');
			selectors[0].onchange = (e) => this.updateRule(i, 'field', e.target.value);
			selectors[1].onchange = (e) => this.updateRule(i, 'relation', e.target.value);
			const inputs = ruleRow.querySelectorAll('input[type="text"]');
			inputs[0].onchange = (e) => this.updateRule(i, 'argument', e.target.value, true);
			inputs[1].onchange = (e) => this.updateRule(i, 'classes', e.target.value, true);
			ruleRow.querySelector('input[type="checkbox"]').onchange = (e) => this.updateRule(i, 'enabled', e.target.checked);
			rulesContainer.appendChild(ruleRow);
		});

		this.applyStyles();
	}

	applyStyles() {
		let styleEl = document.getElementById('tweet-custom-styles');
		if (!styleEl) {
			styleEl = document.createElement('style');
			styleEl.id = 'tweet-custom-styles';
			document.head.appendChild(styleEl);
		}
		styleEl.textContent = this.classes.map(cls => `article.${cls.name}, article.${cls.name} *:is(:not(:has(*)), [dir]) { ${cls.css} }`).join('\n');
	}

    saveToStorage() {
        localStorage.setItem('tweetRules', JSON.stringify({
            classes: this.classes,
            rules: this.rules
        }));
    }

	loadFromStorage() {
		const saved = JSON.parse(localStorage.getItem('tweetRules') || '{}');
		this.classes = saved.classes || [];
		this.rules = saved.rules || [];
		this.renderUI();
	}

	evaluateRule(rule, tweetData) {
		if (!rule.enabled) return false;

		const getValue = (field) => {
			switch(field) {
				case 'name': return tweetData.content?.author?.name || '';
				case 'id': return tweetData.content?.author?.id || '';
				case 'verified': return tweetData.content?.author?.verified || false;
				case 'views': return tweetData.stats?.views || 0;
				case 'likes': return tweetData.stats?.likes || 0;
				case 'retweets': return tweetData.stats?.retweets || 0;
				case 'replies': return tweetData.stats?.replies || 0;
				case 'text': return tweetData.content?.text || '';
				case 'date': return tweetData.content?.date || '';
				case 'images': return tweetData.images || [];
				case 'reposter name': return tweetData.repost?.name || '';
				case 'reposter id': return tweetData.repost?.id || '';
				case 'quoted name': return tweetData.content?.quote?.author?.name || '';
				case 'quoted id': return tweetData.content?.quote?.author?.id || '';
				case 'quoted text': return tweetData.content?.quote?.content?.text || '';
				case 'quoted date': return tweetData.content?.quote?.content?.date || '';
				case 'quoted verified': return tweetData.content?.quote?.author?.verified || false;
				default: return '';
			}
		};

		const value = getValue(rule.field);
		const arg = rule.argument;

		switch(rule.relation) {
			case 'contains': return new RegExp(arg, 'i').test(String(value));
			case "doesn't contain": return !(new RegExp(arg, 'i').test(String(value)));
			case 'equals': return String(value) === arg;
			case 'doesn\'t equal': return String(value) !== arg;
			case 'at least': return Number(value) >= Number(arg);
			case 'at most': return Number(value) <= Number(arg);
			case 'exists': return value;
			case 'doesn\'t exist': return !value;
			case 'is true': return value;
			case 'is false': return !value;
			default: return false;
		}
	}

}

const throttle = (func, rateLimit) => {
    let inThrottle;
	if (rateLimit <= 0) return func;
    return function() {
        const args = arguments;
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {inThrottle = false}, rateLimit);
        }
    }
}

function cleanCache(cache) {
    if (cache.size > MAX_CACHE_SIZE) {
        const keys = Array.from(cache.keys());
        keys.slice(0, cache.size - MAX_CACHE_SIZE).forEach(cache.delete, cache);
    }
}

(function() {
	let tweetCache = new Map();
	const tweetRulesManager = new TweetRulesManager();
	const throttledScrollHandler = throttle(() => {
		Dom.all('article').forEach(article => {
			getTweetData(article, tweetCache, tweetRulesManager);
			article.onhover = () => (getTweetData(this, tweetCache, tweetRulesManager));
		});
	}, 0);
	const throttledCacheCleaner = throttle(() => {
		cleanCache(tweetCache);
	}, 1000);

	window.addEventListener('scroll', throttledScrollHandler);
	window.addEventListener('scroll', throttledCacheCleaner);

	setInterval(throttledScrollHandler, 250);

	const toggleMenuBtn = document.getElementById('toggle-menu');
	const menu = document.getElementById('tweet-rules-menu');

	toggleMenuBtn.addEventListener('click', () => {
        menu.classList.toggle('hidden');
        toggleMenuBtn.textContent = menu.classList.contains('hidden') ? 'Show' : 'Hide';
    });

})();
