import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script=fs.readFileSync(new URL('../public/js/admin.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/css/styles.css',import.meta.url),'utf8');
const elements={
  '#loginView':{hidden:false},
  '#adminView':{hidden:true},
  '#loginForm':{reset(){this.didReset=true}},
  '#loginStatus':{textContent:'Incorrect password.'},
  '.admin-sidebar':{classList:{remove(){}}}
};
const source=script.slice(script.indexOf('function showLogin('),script.indexOf('async function loadData('));
const context=vm.createContext({$:selector=>elements[selector]});
vm.runInContext(source+';showLogin(false)',context);
assert.equal(elements['#loginView'].hidden,true);
assert.equal(elements['#adminView'].hidden,false);
assert.equal(elements['#loginForm'].didReset,true);
assert.equal(elements['#loginStatus'].textContent,'');
vm.runInContext('showLogin(true)',context);
assert.equal(elements['#loginView'].hidden,false);
assert.equal(elements['#adminView'].hidden,true);
assert.match(css,/\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/);
console.log('Admin login/logout visibility and hidden CSS regression passed.');
