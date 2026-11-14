'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('simple-home.css','utf8'),navcss=fs.readFileSync('route-navigation.css','utf8');
const home=html.split('<section class="screen active rr-welcome-screen" id="home"')[1]?.split('<section class="screen rr-create-screen" id="create"')[0];
const make=html.split('<section class="screen rr-create-screen" id="create"')[1]?.split('<section class="screen" id="route"')[0];
const route=html.split('<section class="screen" id="route"')[1]?.split('<section class="screen" id="shop"')[0];
assert.ok(home&&make&&route);
for(const x of ['id="rrHomeWeatherValue"','Исследуем Якутск','rr-welcome-mascot','id="homeOpenCreateBtn"','rr-marshik-pointer','rr-marshik-pointing-hand'])assert.ok(home.includes(x),x);
for(const x of ['smartChat','id="homeMap"','rdq-card','quickInfoGrid','id="distanceInput"','id="buildBtn"'])assert.ok(!home.includes(x),'unexpected on home '+x);
for(const x of ['id="distanceInput"','id="typeChoices"','id="partnerToggle"','id="createMapDetails"','id="homeMap"','id="buildBtn"','id="rrDailyCreateMount"'])assert.ok(make.includes(x),x);
assert.equal((make.match(/data-distance-km="/g)||[]).length,4);
assert.ok(make.includes('id="rrStartSettings"')&&make.includes('rr-create-start-compact'),
 'GPS settings should be collapsed into one compact row');
assert.ok(!make.includes('<h2 id="rrStartTitle"'),
 'remove the large third step panel');
assert.ok(make.includes('id="yakutskLocationStatus"')&&make.includes('id="locateYakutskBtn"')&&make.includes('id="demoYakutskBtn"'),
 'retain real and demo GPS choices');
assert.ok(css.includes('#rrStartSettings.rr-create-start-compact'), 'compact GPS styles missing');
assert.equal((make.match(/class="choice(?: active)?" data-type="/g)||[]).length,3);
assert.ok(!make.includes('<textarea')&&!html.includes('id="smartRouteChat"'));
assert.ok(html.includes("$$('[data-distance-km]').forEach"));
assert.ok(html.includes('syncRouteChoiceButtons'));
assert.ok(html.includes('data-open-screen="create"'));
assert.ok(html.includes('route-navigation.js?v=1.0'));
for(const id of ['rrNavPanel','rrNavArrow','rrNavInstruction','rrNavNext','rrNavTotal','rrNavTime','rrNavProgress'])assert.ok(route.includes('id="'+id+'"'),id);
assert.ok(html.includes('updateLiveRouteProgress(p,sane)'),'GPS navigation must update with actual position');
assert.ok(html.includes('mapFollowBtn')&&html.includes('autoFollow(p,false)'),'follow GPS map');
assert.ok(html.includes('yPassedLine'),'draw past trail');
assert.ok(css.includes('.rr-welcome-start')&&css.includes('.rr-wish-buttons')&&css.includes('.rr-distance-options'));
assert.ok(css.includes('rrMarshikCtaPulse')&&css.includes('prefers-reduced-motion:reduce'),
 'Marshik arrow and CTA must honor reduced-motion users');
assert.ok(html.includes('rr-marshik-cta-active')&&html.includes('rr-marshik-pointer-svg'),
 'the CTA and directional arrow should be present even for returning users');
assert.ok(!html.includes("const key='rr_marshik_route_cta_used_v1'"),
 'old one-time dismissal logic must not hide Marshik');
assert.ok(navcss.includes('.rr-nav-panel')&&navcss.includes('prefers-reduced-motion:reduce'));
console.log('Welcome screen, accessible button wizard and animated GPS navigation integration OK');
