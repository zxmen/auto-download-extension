document.getElementById('startButton').addEventListener('click', function() {
    chrome.runtime.sendMessage({action: 'startDownload'});
});

document.getElementById('clearButton').addEventListener('click', function() {
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(['processedTabs', 'downloadInfo'], function() {
            alert('记录已清除');
        });
    } else {
        alert('无法访问存储，请检查扩展权限');
    }
});
