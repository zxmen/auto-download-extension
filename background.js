let downloadInfo;

// 初始化 downloadInfo
chrome.storage.local.get(['downloadInfo'], function(result) {
	downloadInfo = result.downloadInfo || {};
});

// 获取所有标签页并处理第一个标签页
function getAllTabs() {
	chrome.tabs.query({}, function(tabs) {
		// 获取已处理过的标签页ID列表
		chrome.storage.local.get(['processedTabs'], function(result) {
			const processedTabs = result.processedTabs || [];
			
			// 过滤出未处理的符合条件的标签页
			const targetTabs = tabs.filter(tab => {
				if (!tab.url) {
					console.log('标签页缺少URL:', tab);
					return false;
				}
				
				const isValidTab = tab.url.includes('forum.php?mod=viewthread') && 
								 !processedTabs.includes(tab.id);
				
				// if (isValidTab) {
				// 	console.log('找到符合条件的标签页:', tab);
				// }
				
				return isValidTab;
			});
			
			console.log('符合条件的标签页数量:', targetTabs.length);
			
			if (targetTabs.length > 0) {
				const tab = targetTabs[0];
				if (tab) {
					// 记录已处理的标签页ID
					processedTabs.push(tab.id);
					chrome.storage.local.set({ processedTabs: processedTabs });
					processTab(tab);
				}
			} else {
				console.log('没有找到符合条件的标签页');
			}
		});
	});
}

// 处理单个标签页
function processTab(tab) {
	// 先激活标签页
	chrome.tabs.update(tab.id, { active: true }, function(activeTab) {
		// 等待一小段时间确保标签页完全激活
		setTimeout(() => {
			chrome.scripting.executeScript({
				target: { tabId: activeTab.id },
				function: clickLinkAndDownload,
				args: [activeTab.id]
			}, (results) => {
				if (chrome.runtime.lastError) {
					console.error('执行脚本时出错:', chrome.runtime.lastError);
					return;
				}
			});
		}, 500); // 等待500ms
	});
}

function clickLinkAndDownload(originalTabId) {
	function setItem(originalTabId, pageTitle) {
		chrome.storage.local.set({
			originalTabId: originalTabId,
				tabTitle: pageTitle
		});
	}

	const tdElement = document.querySelector('td[id^="postmessage"]');
	if (!tdElement) {
		console.log('未找到帖子内容元素');
		getAllTabs();
		return;
	}

	const link = tdElement.querySelector('a[href^="http://www.xunniu"]');
	const pageTitle = document.querySelector('#thread_subject');
	
	if (!pageTitle) {
		console.log('未找到帖子标题元素');
		getAllTabs();
		return;
	}

	console.log('帖子标题:', pageTitle.innerText);
	
	// 尝试查找并点击下载链接
	if (link) {
		//修改link的href
		link.href = link.href.replace('file-','down-').replace('pan.com','yun.com');
		console.log('link', link);
		setItem(originalTabId, pageTitle.innerText);
		link.click();
		return;
	}
	
	// 尝试查找并点击font中的链接
	const fontElements = tdElement.querySelectorAll('font');
	for (const font of fontElements) {
		if (font.textContent.trim().startsWith('http://www.xunniu')) {
			setItem(originalTabId, pageTitle.innerText);
			window.open(font.textContent.trim().replace('file-','down-').replace('pan.com','yun.com'), '_blank');
			return;
		}
	}
	
	// 如果没找到下载链接，直接处理下一个标签页
	getAllTabs();
}




// 监听下载完成事件
chrome.downloads.onChanged.addListener(function(downloadDelta) {
	console.log(downloadDelta);
	if (downloadDelta.state && downloadDelta.state.current === 'complete') {
		chrome.storage.local.get(['originalTabId', 'tabTitle'], function(result) {
			const originalTabId = parseInt(result.originalTabId, 10);
			const tabTitle = result.tabTitle;

			// 关闭当前标签页
			chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
				if (tabs.length > 0) {
					chrome.tabs.remove(tabs[0].id);
				}
			});

			if (!isNaN(originalTabId) && tabTitle) {
				// 记录下载信息
				chrome.downloads.search({ id: downloadDelta.id }, function(results) {
					if (results.length > 0) {
						const filename = results[0].filename;
						downloadInfo[downloadDelta.id] = {
							title: tabTitle,
							filename: filename
						};

					// 更新存储
					chrome.storage.local.set({ downloadInfo: downloadInfo });
				}
			});

				// 关闭原始标签页
				chrome.tabs.remove(originalTabId, function() {
					chrome.storage.local.remove(['originalTabId', 'tabTitle']);
					// 下载完成后立即执行下一个任务
					getAllTabs();
				});
			}
		});
	}
});

// 监听来自 popup.js 的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.action === 'startDownload') {
		getAllTabs();
	}
});

function clearProcessedTabs() {
	chrome.storage.local.remove('processedTabs');
}