(() => {
  const download = document.querySelector('#apk-download');
  if (!download) return;
  const sha = document.querySelector('#apk-sha');
  document.querySelector('#copy-sha').addEventListener('click', async () => {
    try {await navigator.clipboard.writeText(sha.textContent);document.querySelector('#copy-status').textContent='Checksum copied.';}
    catch {document.querySelector('#copy-status').textContent='Select the checksum above to copy it manually.';}
  });
  const prefix = 'https://github.com/Atticus-42/los-radios-packs/releases/';
  fetch('https://api.github.com/repos/Atticus-42/los-radios-packs/releases?per_page=30', {signal:AbortSignal.timeout(8000)})
    .then(r => {if(!r.ok) throw Error('Unavailable');return r.json();})
    .then(releases => {
      const release = releases.filter(r => !r.draft && /^los-radios-v/.test(r.tag_name)).sort((a,b) => Date.parse(b.published_at)-Date.parse(a.published_at)).find(r => r.assets?.some(a => a.name === 'Los-Radios.apk' && a.state === 'uploaded'));
      const asset = release?.assets.find(a => a.name === 'Los-Radios.apk' && a.state === 'uploaded');
      if(!asset || !asset.browser_download_url.startsWith(prefix+'download/') || !release.html_url.startsWith(prefix+'tag/')) throw Error('No verified release URL');
      download.href=asset.browser_download_url;
      document.querySelector('#release-notes').href=release.html_url;
      document.querySelector('#release-version').textContent=release.tag_name.replace(/^los-radios-v/,'');
      document.querySelector('#release-state').textContent=release.prerelease?'LATEST PREVIEW':'LATEST RELEASE';
      document.querySelector('#release-size').textContent=(asset.size/1e6).toFixed(1)+' MB · See release notes for Android requirements';
      document.querySelector('#release-status').textContent='Latest published build · '+new Date(release.published_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
      const digest = /^sha256:([a-f0-9]{64})$/i.exec(asset.digest || '');
      sha.textContent=digest?digest[1]:'See the release notes for this build’s checksum.';
      document.querySelector('#copy-sha').hidden=!digest;
    }).catch(() => {document.querySelector('#release-status').textContent='Showing the verified 4 November 2026 build. Open release notes to check for updates.';});
})();
