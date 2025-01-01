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
				
				// const isValidTab = tab.url.includes('forum.php?mod=viewthread') && !processedTabs.includes(tab.id);
				const isValidTab =!processedTabs.includes(tab.id);
				// return isValidTab;
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

async function clickLinkAndDownload(originalTabId) {
	function setItem(originalTabId, pageTitle, fileId) {
		chrome.storage.local.set({
			originalTabId: originalTabId,
			tabTitle: pageTitle,
			fileId: fileId
		});
	}

	function splitFileId(url){
		// 截取url中-和.htm之间的字符串
		const fileId = url.split('-')[1].split('.htm')[0];
		return fileId;
	}
	const tdElement = document.querySelector('td[id^="postmessage"]');
	if (!tdElement) {
		console.log('未找到帖子内容元素');
		continueProcessing()
		return;
	}

	const link = tdElement.querySelector('a[href^="http://www.xunniu"]');
	const pageTitle = document.querySelector('#thread_subject');
	
	if (!pageTitle) {
		console.log('未找到帖子标题元素');
		continueProcessing()
		return;
	}
	
	// 尝试查找并点击下载链接
	if (link) {
		//修改link的href
		link.href = link.href.replace('file-','down-').replace('pan.com','yun.com');
		console.log('link', link);
		const fileId = splitFileId(link.href);
		setItem(originalTabId, pageTitle.innerText, fileId);
		link.click();
		return;
	}
	
	// 尝试查找并点击font中的链接
	const fontElements = tdElement.querySelectorAll('font');
	for (const font of fontElements) {
		if (font.textContent.trim().startsWith('http://www.xunniu')) {
			const fileId = splitFileId(font.textContent.trim());
			setItem(originalTabId, pageTitle.innerText, fileId);
			window.open(font.textContent.trim().replace('file-','down-').replace('pan.com','yun.com'), '_blank');
			return;
		}
	}
	
	continueProcessing()
	// 如果没找到下载链接，直接处理下一个标签页
	function continueProcessing() {
		chrome.runtime.sendMessage({ action: 'continueProcessing' });
	}
}

	// 将下载信息上传到服务器
	function uploadDownloadInfo(fileId,fileName,title) {
		// 将下载信息上传到服务器
		return new Promise((resolve, reject) => {
			fetch('http://localhost:3000/xnFile/create', {
				method: 'POST',
				timeout: 2000,
				headers: {
					'Content-Type': 'application/json', // 设置请求头为 JSON
					'Accept': '*/*'
			},
				body: JSON.stringify({ fileId,fileName,title })
			}).then(response => response.json())
			.then(data => {
				if(data.code == 200){
					resolve(true)
				}else{
					resolve(false)
				}
			})
			.catch(error => reject(false));
		});
	}

function updateDownloadInfo(fileId) {
	// 将下载信息上传到服务器
	return new Promise((resolve, reject) => {
		fetch('http://localhost:3000/xnFile/update', {
			method: 'POST',
			timeout: 2000,
			headers: {
				'Content-Type': 'application/json', // 设置请求头为 JSON
				'Accept': '*/*'
		},
			body: JSON.stringify({ fileId,status:1 })
		}).then(response => response.json())
		.then(data => {
			if(data.code == 200){
				resolve(true)
			}else{
				resolve(false)
			}
		})
		.catch(error => reject(false));
	});
}

chrome.downloads.onCreated.addListener(function(downloadItem) {
	console.log('下载开始:', downloadItem);
	// 获取下载的文件名
	const filename = downloadItem.filename;
	console.log('filename',filename)
	chrome.storage.local.get(['originalTabId', 'tabTitle', 'fileId','downloadList'], async function(result) {
		const originalTabId = parseInt(result.originalTabId, 10);
		const tabTitle = result.tabTitle;
		const fileId = result.fileId;
		console.log('originalTabId',originalTabId)
		console.log('tabTitle',tabTitle)
		console.log('fileId',fileId)
		if (!await uploadDownloadInfo(fileId,filename,tabTitle)) {
			// 如果上传失败，则将这条下载信息记录下来
			let downloadInfo = {
				fileId: fileId,
				filename: filename,
				title: tabTitle,
				status: 0
			}
			let downloadList = result.downloadList || {};
			downloadList[fileId] = downloadInfo;
			chrome.storage.local.set({ downloadList: downloadList });
		}
	});
});

// 监听下载完成事件
chrome.downloads.onChanged.addListener(async function(downloadDelta) {
	console.log('downloadDelta',downloadDelta)
	if (downloadDelta.state && downloadDelta.state.current === 'complete') {
		chrome.storage.local.get(['originalTabId', 'tabTitle','downloadList','fileId'], async function(result) {
			const originalTabId = parseInt(result.originalTabId, 10);
			const tabTitle = result.tabTitle;
			const fileId = result.fileId;
			const downloadList = result.downloadList || {};
			if(downloadList[fileId]){
				// 如果下载信息已经存在，则更新下载信息
				downloadList[fileId].status = 1;
				chrome.storage.local.set({ downloadList: downloadList });
			}else{
				if(!await updateDownloadInfo(downloadDelta.id)){
					// 如果更新失败，则将这条下载信息记录下来
					downloadList[fileId] = {
						fileId: fileId,
						filename: filename,
						title: tabTitle,
						status: 1
					}
					chrome.storage.local.set({ downloadList: downloadList });
				}
			}
			// if (!await updateDownloadInfo(downloadDelta.id)) {
			// 	// 如果更新失败，则将这条下载信息记录下来

			// }
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
	} else if (request.action === 'continueProcessing') {
		getAllTabs();
	}
});
function clearProcessedTabs() {
	chrome.storage.local.remove('processedTabs');
}