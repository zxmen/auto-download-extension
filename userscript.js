// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      2024-12-28
// @description  try to take over the world!
// @author       You
// @match        http://www.xunniuyun.com/down*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
	'use strict';
setTimeout(function(){
	let addr_list = document.querySelector('#addr_list');
	let aList = addr_list.querySelectorAll('a');
	let aItem = aList[aList.lenght - 1];
	aItem.click();
},5000n)
	
})();