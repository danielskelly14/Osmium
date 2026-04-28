/* --- Blob Cloak (top-level only) --- */
(function(){
    function escapeBlobAttr(value){
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function openBlobCloak(targetUrl){
        try {
            if (!targetUrl) return;
            var safeUrl = escapeBlobAttr(targetUrl);
            var html = '<!doctype html><html><head><meta charset="utf-8"><title>...</title><style>html,body{margin:0;height:100%;}iframe{width:100%;height:100%;border:0;}</style></head><body><iframe src="' + safeUrl + '" allow="fullscreen"></iframe></body></html>';
            var blob = new Blob([html], { type: 'text/html' });
            var blobUrl = URL.createObjectURL(blob);
            localStorage.setItem('blobCloakLastUrl', targetUrl);
            location.replace(blobUrl);
        } catch (e) {
            // ignore blob cloak errors
        }
    }

    function exitBlobCloak(){
        try {
            var target = localStorage.getItem('blobCloakLastUrl') || '/index.html';
            localStorage.setItem('blobCloakEnabled', 'false');
            if (location.protocol === 'blob:') {
                location.replace(target);
            }
        } catch (e) {
            // ignore
        }
    }

    function tryBlobCloak(){
        try {
            if (window.top !== window.self) return;
            if (localStorage.getItem('blobCloakEnabled') !== 'true') return;
            if (location.protocol === 'blob:') return;
            openBlobCloak(location.href);
        } catch (e) {
            // ignore
        }
    }

    window.openBlobCloak = openBlobCloak;
    window.exitBlobCloak = exitBlobCloak;
    tryBlobCloak();
})();

/* --- Non-blocking ads loader --- */
(function(){
    function loadMainAdsIfEnabled(){
        try {
            if (localStorage.getItem('adsEnabled') === 'false') return;
            if (document.getElementById('main-ad-script')) return;

            var adScript = document.createElement('script');
            adScript.id = 'main-ad-script';
            adScript.async = true;
            adScript.dataset.zone = '10557680';
            adScript.src = ;
            (document.body || document.documentElement).appendChild(adScript);
        } catch (e) {
            // ignore ad script errors
        }
    }

    window.loadMainAdsIfEnabled = loadMainAdsIfEnabled;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadMainAdsIfEnabled, { once: true });
    } else {
        loadMainAdsIfEnabled();
    }
})();

// Check if particles are enabled (default true)
if (
    localStorage.getItem('particlesEnabled') !== 'false' &&
    typeof particlesJS === 'function' &&
    document.getElementById('particles-js')
) {
    particlesJS("particles-js", {
        particles: {
            number: { value: 70 },
            shape: { type: "circle" },
            opacity: { value: 1 }, 
            size: { value: 2, random: true }, 
            move: {
                enable: true,
                speed: 12, 
                straight: false, 
                out_mode: "out"
            },
            line_linked: { enable: false }, 
            color: { value: ["#ffffff", "#d0e8ff", "#9fb2cf", "#afebff", "#b0c8d8"] } 
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: { enable: false }, 
                onclick: { enable: false }
            }
        }
    });
}

/* --- Remove Ads if Disabled --- */
(function(){
    // Check ads setting immediately
    if (localStorage.getItem('adsEnabled') === 'false') {
        // Remove existing ad scripts
        var adScript = document.getElementById('main-ad-script');
        if (adScript) {
            adScript.remove();
        }
        
        // Prevent any future ad scripts from loading by monitoring DOM
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        // Remove script tags that contain ad-related code
                        if (node.tagName === 'SCRIPT') {
                            var src = node.src || '';
                            var text = node.textContent || '';
                            // Check for common ad patterns
                            if (src.includes('al5sm.com') || src.includes('nap5k.com') ||
                                text.includes('al5sm.com') || text.includes('nap5k.com')) {
                                node.remove();
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }
})();

// panic key
function isTypingInField(e){
    var el = e.target;
    if(!el) return false;
    var tag = el.tagName && el.tagName.toLowerCase();
    if(tag === 'input' || tag === 'textarea') return true;
    if(el.isContentEditable) return true;
    return false;
}

// also panic key set to ` (next to 1 key)
window.addEventListener('keydown', function(e){
    if(e.ctrlKey || e.altKey || e.metaKey) return;
    if(isTypingInField(e)) return;

    if(e.key === '`' || e.code === 'Backquote'){
        // prevent accidental behavior
        e.preventDefault();
        window.location.href = 'https://classroom.google.com/';
    }
});
// search bar enter
window.addEventListener('DOMContentLoaded', function(){
    var searchBar = document.getElementById('searchBar');
    if(searchBar){
        searchBar.addEventListener('keydown', function(e){
            if(e.key === 'Enter' || e.keyCode === 13){
                e.preventDefault();
                if(typeof searchToGames === 'function'){
                    searchToGames();
                }
            }
        });
    }

    var gameButtonImages = document.querySelectorAll('.game-button img');
    gameButtonImages.forEach(function(img, index){
        if (!img.loading) img.loading = 'lazy';
        img.decoding = 'async';
        if (index < 12) img.fetchPriority = 'high';
    });
});

/* --- Adaptive particle count based on FPS ---
   Behavior:
   - Measure FPS using a lightweight RAF counter.
   - If FPS drops significantly compared to the recent average, step the particle count down.
   - If FPS rises significantly compared to the recent average, step the particle count up.
   - Clamp particle count between minParticles and maxParticles.
   - Use particles.js instance API (window.pJSDom[0].pJS) and call particlesRefresh() after changing the value.
   Notes: adjustments are stepwise (not directly proportional to FPS) and rate-limited.
*/
(function(){
    var minParticles = 10;
    var maxParticles = 120;
    var step = 8; // how many particles to add/remove per change
    var adjustCooldown = 1500; // ms between adjustments
    var threshold = 3; // FPS change threshold to trigger adjustments

    var frames = 0;
    var lastCheck = performance.now();
    var lastFPS = 60; // initial baseline
    var rafId = null;
    var lastAdjustTime = 0;

    function rafTick(now){
        frames++;
        rafId = requestAnimationFrame(rafTick);
    }

    function tryAdjustParticles(currentFps){
        // smooth the FPS a bit using previous value
        var smoothed = (lastFPS * 0.6) + (currentFps * 0.4);
        var diff = smoothed - lastFPS;

        // decide change direction
        var now = Date.now();
        if(now - lastAdjustTime < adjustCooldown) return; // rate-limit

        // get current particle instance safely
        if(!window.pJSDom || !window.pJSDom.length) return;
        var pJS = window.pJSDom[0] && window.pJSDom[0].pJS;
        if(!pJS) return;

        var current = parseInt(pJS.particles.number.value, 10) || 0;
        var newCount = current;

        if(diff <= -threshold) {
            // fps dropped — reduce particles
            newCount = Math.max(minParticles, current - step);
        } else if(diff >= threshold) {
            // fps rose — increase particles
            newCount = Math.min(maxParticles, current + step);
        }

        if(newCount !== current){
            try{
                pJS.particles.number.value = newCount;
                // refresh will rebuild particle array according to the new number
                if(pJS.fn && pJS.fn.particlesRefresh) pJS.fn.particlesRefresh();
                lastAdjustTime = now;
                // update lastFPS baseline toward smoothed value
                lastFPS = smoothed;
                // small console debugging (can be removed later)
                if(window.DEBUG_PARTICLES) console.log('Adjusted particles', current, '->', newCount, 'fps:', Math.round(currentFps));
            }catch(e){
                // ignore errors — particles.js may not be initialized yet
            }
        } else {
            // even if we didn't change, update baseline smoothing
            lastFPS = smoothed;
        }
    }

    // interval check every 1000ms
    function startMonitoring(){
        // start RAF to count frames
        if(!rafId) rafId = requestAnimationFrame(rafTick);

        setInterval(function(){
            var now = performance.now();
            var elapsed = now - lastCheck;
            if(elapsed <= 0) return;
            var currentFps = (frames / elapsed) * 1000;
            frames = 0;
            lastCheck = now;
            tryAdjustParticles(currentFps);
        }, 1000);
    }

    // Start monitoring after DOM is ready and particles.js has been initialized
    if(document.readyState === 'complete' || document.readyState === 'interactive'){
        // delay a tick to allow particlesJS() to run if it's called later in the same tick
        setTimeout(startMonitoring, 500);
    } else {
        window.addEventListener('DOMContentLoaded', function(){ setTimeout(startMonitoring, 500); });
    }

})();

/* --- Tab Cloak System (persists across all pages) --- */
(function(){
    // Tab cloak presets - available globally
    window.CLOAKS = {
        google: { title: 'Google', icon: '/s/assets/google.ico' },
        classroom: { title: 'Google Classroom', icon: '/s/assets/classroom.ico' },
        drive: { title: 'My Drive - Google Drive', icon: '/s/assets/drive.png' },
        gmail: { title: 'Gmail', icon: '/s/assets/gmail.ico' },
        ixl: { title: 'IXL | Dashboard', icon: '/s/assets/ixl.png' },
        meet: { title: 'Google Meet', icon: '/s/assets/meet.png' },
        docs: { title: 'Document - Google Docs', icon: '/s/assets/docs.ico' },
        sheets: { title: 'Spreadsheet - Google Sheets', icon: '/s/assets/sheets.ico' },
        slides: { title: 'Presentation - Google Slides', icon: '/s/assets/slides.ico' }
    };

    window.DEFAULT_CLOAK = { title: "Markos's Classroom", icon: '/s/dogfavi.png' };

    // Apply cloak immediately on page load (before DOMContentLoaded)
    function applyTabCloak() {
        try {
            var saved = localStorage.getItem('tabCloak');
            if (!saved) return;
            
            var data = JSON.parse(saved);
            if (!data || !data.title || !data.icon) return;

            // Set title immediately
            document.title = data.title;

            // Set favicon
            var favicon = document.querySelector("link[rel='icon']");
            if (!favicon) {
                favicon = document.createElement('link');
                favicon.rel = 'icon';
                document.head.appendChild(favicon);
            }
            favicon.href = data.icon;
        } catch (e) {
            // silently fail if localStorage is unavailable or data is corrupted
        }
    }

    // Apply cloak as early as possible
    applyTabCloak();

    // Expose global function for settings page to call
    window.applyCloakSelection = function(key) {
        var preset = window.CLOAKS[key] || window.DEFAULT_CLOAK;
        document.title = preset.title;

        var favicon = document.querySelector("link[rel='icon']");
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.href = preset.icon;

        localStorage.setItem('tabCloak', JSON.stringify({ key: key, title: preset.title, icon: preset.icon }));
        
        // Update status if on settings page
        var status = document.getElementById('cloakStatus');
        if (status) {
            status.textContent = 'Current: ' + preset.title;
        }
    };

})();

/* --- Particles Toggle --- */
window.toggleParticles = function() {
    var isEnabled = localStorage.getItem('particlesEnabled') !== 'false';
    localStorage.setItem('particlesEnabled', isEnabled ? 'false' : 'true');
};

/* --- Device Warning Popup (once per week) --- */
(function(){
    // Check if we should show the warning (only once per week)
    var lastShown = localStorage.getItem('deviceWarningShown');
    var now = Date.now();
    var oneWeek = 7 * 24 * 60 * 60 * 1000; // milliseconds in a week
    
    if (lastShown && (now - parseInt(lastShown)) < oneWeek) {
        return; // Don't show if shown within the last week
    }

    // Source - https://stackoverflow.com/a/11381730
    // Posted by Michael Zaporozhets, modified by community. See post 'Timeline' for change history
    // Retrieved 2026-01-31, License - CC BY-SA 4.0
    function mobileCheck() {
        var check = false;
        (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
        return check;
    }

    function detectDevice() {
        var isMobile = mobileCheck();
        if (!isMobile) return 'desktop';
        
        // Check screen size to differentiate phone vs tablet
        var width = window.innerWidth || document.documentElement.clientWidth;
        
        // Skip tablets with large screens (1024px+)
        if (width >= 1024) {
            return 'desktop';
        }
        
        if (width < 768) {
            return 'phone';
        } else {
            return 'tablet';
        }
    }

    var deviceType = detectDevice();
    
    // Only show warning for phones and tablets
    if (deviceType === 'desktop') {
        return;
    }

    // Create popup HTML
    function createWarningPopup() {
        var overlay = document.createElement('div');
        overlay.id = 'deviceWarningOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
        
        var popup = document.createElement('div');
        popup.style.cssText = 'background:#1a1a1a;border:2px solid #ffffff7f;border-radius:12px;padding:30px;max-width:500px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.5);text-align:center;';
        
        var message = document.createElement('p');
        message.style.cssText = 'color:#fff;font-size:16px;line-height:1.6;margin:0 0 20px 0;';
        message.textContent = 'We recommend you use a computer or laptop, or to turn your device into landscape mode.';
        
        var button = document.createElement('button');
        button.id = 'deviceWarningBtn';
        button.textContent = 'OK (5)';
        button.disabled = true;
        button.style.cssText = 'background:#444;color:#999;border:2px solid #555;padding:12px 30px;border-radius:8px;font-size:16px;font-weight:600;cursor:not-allowed;transition:all 0.3s;';
        
        var countdown = 5;
        var countdownInterval = setInterval(function(){
            countdown--;
            if (countdown > 0) {
                button.textContent = 'OK (' + countdown + ')';
            } else {
                clearInterval(countdownInterval);
                button.textContent = 'OK';
                button.disabled = false;
                button.style.cssText = 'background:#4CAF50;color:#fff;border:2px solid #45a049;padding:12px 30px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.3s;';
            }
        }, 1000);
        
        button.addEventListener('click', function(){
            if (!button.disabled) {
                document.body.removeChild(overlay);
                localStorage.setItem('deviceWarningShown', Date.now().toString());
            }
        });
        
        button.addEventListener('mouseenter', function(){
            if (!button.disabled) {
                button.style.background = '#45a049';
            }
        });
        
        button.addEventListener('mouseleave', function(){
            if (!button.disabled) {
                button.style.background = '#4CAF50';
            }
        });
        
        popup.appendChild(message);
        popup.appendChild(button);
        overlay.appendChild(popup);
        
        return overlay;
    }

    // Show popup when DOM is ready
    function showWarning() {
        var popup = createWarningPopup();
        document.body.appendChild(popup);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showWarning);
    } else {
        showWarning();
    }
})();

/* --- Mobile Header Adjustments --- */
(function(){
    // Source - https://stackoverflow.com/a/11381730
    // Posted by Michael Zaporozhets, modified by community. See post 'Timeline' for change history
    // Retrieved 2026-01-31, License - CC BY-SA 4.0
    function mobileCheck() {
        var check = false;
        (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
        return check;
    }

    function applyMobileStyles() {
        if (!mobileCheck()) return;
        
        var width = window.innerWidth || document.documentElement.clientWidth;
        
        // Create style element for mobile adjustments
        var style = document.createElement('style');
        style.id = 'mobile-header-styles';
        
        var css = '';
        
        // Hide "Osmium" text on mobile
        css += '.header-text { display: none !important; }';
        
        // Only make buttons smaller if screen is narrow (< 768px)
        if (width < 768) {
            // Make home page buttons smaller
            css += '.nav-button-large { padding: 10px 16px !important; font-size: 14px !important; }';
            css += '.button-container { gap: 8px !important; }';
            css += '.button-container .center-button { padding: 8px 12px !important; font-size: 12px !important; }';
        }
        
        // For very small screens (< 400px), arrange nav in 2x2 grid
        if (width < 400) {
            // Apply grid layout to nav-container
            css += '.nav-container { display: grid !important; grid-template-columns: 1fr 1fr !important; grid-template-rows: 1fr 1fr !important; width: 100% !important; justify-items: stretch !important; align-items: stretch !important; gap: 3px !important; padding: 4px !important; row-gap: 3px !important; column-gap: 3px !important; }';
            // Make buttons fill grid cells properly
            css += '.nav-container button, .nav-container .center-button { width: 100% !important; height: 100% !important; box-sizing: border-box !important; padding: 10px 8px !important; font-size: 11px !important; min-width: auto !important; margin: 0 !important; }';
        } else if (width < 768) {
            // Normal small screen (not grid layout)
            css += '.nav-container { gap: 3px !important; padding: 4px !important; }';
            css += '.nav-container button, .nav-container .center-button { padding: 15px 10px !important; font-size: 11px !important; min-width: auto !important; margin: 0 !important; }';
        }
        
        style.textContent = css;
        document.head.appendChild(style);
    }

    // Apply styles when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyMobileStyles);
    } else {
        applyMobileStyles();
    }

    // Reapply on window resize (for orientation changes)
    var resizeTimeout;
    window.addEventListener('resize', function(){
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function(){
            var existingStyle = document.getElementById('mobile-header-styles');
            if (existingStyle) existingStyle.remove();
            applyMobileStyles();
        }, 250);
    });
})();
