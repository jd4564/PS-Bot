(function($) {
    function hashColor(name) {
        var name = toId(name);
        if (Config.customcolors[name]) name = Config.customcolors[name];
        var hash = MD5(name);
        var H = parseInt(hash.substr(4, 4), 16) % 360;
        var S = parseInt(hash.substr(0, 4), 16) % 50 + 50;
        var L = Math.floor(parseInt(hash.substr(8, 4), 16) % 20 / 2 + 30);
        name = 'color:hsl(' + H + ',' + S + '%,' + L + '%);';
        return name;
    }

    function toId(text) {
        text = text || '';
        if (typeof text === 'number') text = '' + text;
        if (typeof text !== 'string') return toId(text && text.id);
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    function escapeHTML(str, jsEscapeToo) {
        str = (str ? '' + str : '');
        str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        if (jsEscapeToo) str = str.replace(/'/g, '\\\'');
        return str;
    }

    var parseLogs = this.parseLogs = function() {
        $('#infoarea').html('<center><font color=black>Loading...</font></center>');
        $.get("logs/" + getUrlVars()["logfile"] + ".txt", function(data) {
            $('#infoarea').html('<center><font color=black>Server: ' + escapeHTML(getUrlVars()["server"]) + ' Room: ' + escapeHTML(getUrlVars()["room"]) + '<br />Date: ' + escapeHTML(getUrlVars()["date"]) + '</font></center>');
            var lines = data.split('\n');
            for (var u in lines) {
                if (lines[u].substr(0, 1) !== '|') lines[u] = '||' + lines[u];
                var parts = lines[u].split('|');
                switch (parts[1]) {
                    case 'c:':
                        var date = Number(parts[2]);
                        if (date.toString().length < 13) {
					        while (date.toString().length < 13) {
						        date = Number(date.toString() + '0');
					        }
				        }
				        date = new Date(date);
				        if (parts[3] === '~') break;
                        var name = parts[3].substr(1, parts[3].length);
                        var group = parts[3].charAt(0);
                        var message = parts.slice(4).join('|');
                        var timestamp = '[' + (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ':' + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + ':' + (date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds()) + ']';
                        $('.inner').append('<div class="chat chatmessage-' + toId(name) + '"><small>' + timestamp + ' </small><strong style="' + hashColor(name) + '"><small>' + group + '</small><span class="username"' +
                            'data-name="' + escapeHTML(name) + '">' + escapeHTML(name) + '</span>:</strong> <em>' + parseMessage(message) + '</em></div>');
                        break;
                    case 'raw':
                    case 'html':
                        $('.inner').append('<div class="notice">' + sanitizeHTML(parts.splice(2).join('|')) + '</div>');
                        break;
                    case '':
                        $('.inner').append('<div class="notice">' + escapeHTML(parts.slice(2).join('|')) + '</div>');
                        break;
                    // we don't parse these messages
                    case 'j':
                    case 'join':
                    case 'J':
                    case 'l':
                    case 'leave':
                    case 'L':
                    case 'init':
                    case 'b':
                    case 'B':
                    case 'n':
                    case 'name':
                    case 'N':
                    case 'users':
                    case 'uhtml':
                    case 'uhtmlchange':
                    case 'unlink':
                    case 'tournament':
                    case 'tournaments':
			    	    break;

                }
            }
        });
    }

    function parseMessage(str) {
        str = escapeHTML(str);
        // Don't format console commands (>>).
        if (str.substr(0, 8) === '&gt;&gt;') return str;
        // Don't format console results (<<).
        if (str.substr(0, 9) === '&lt;&lt; ') return str;
        var options = {};
        // ``code``
        str = str.replace(/\`\`([^< ](?:[^<`]*?[^< ])??)\`\`/g, options.hidemonospace ? '$1' : '<code>$1</code>');
        // ~~strikethrough~~
        str = str.replace(/\~\~([^< ](?:[^<]*?[^< ])??)\~\~/g, options.hidestrikethrough ? '$1' : '<s>$1</s>');
        // <<roomid>>
        str = str.replace(/&lt;&lt;([a-z0-9-]+)&gt;&gt;/g, options.hidelinks ? '&laquo;$1&raquo;' : '&laquo;<a href="/$1">$1</a>&raquo;');
        // linking of URIs

        str = str.replace(linkRegex, function(uri) {
            if (/^[a-z0-9.]+\@/gi.test(uri)) {
                return '<a href="mailto:' + uri + '" target="_blank">' + uri + '</a>';
            }
            // Insert http:// before URIs without a URI scheme specified.

            var fulluri = uri.replace(/^([a-z]*[^a-z:])/g, 'http://$1');
            var r = new RegExp('^https?://' +
                document.location.hostname.replace(/\./g, '\\.') +
                '/([a-zA-Z0-9-]+)$');
            var m = r.exec(fulluri);



            fulluri = escapeHTML(unescapeHTML(fulluri));


            if (uri.substr(0, 24) === 'https://docs.google.com/' || uri.substr(0, 16) === 'docs.google.com/') {
                if (uri.slice(0, 5) === 'https') uri = uri.slice(8);
                if (uri.substr(-12) === '?usp=sharing' || uri.substr(-12) === '&usp=sharing') uri = uri.slice(0, -12);
                if (uri.substr(-6) === '#gid=0') uri = uri.slice(0, -6);
                var slashIndex = uri.lastIndexOf('/');
                if (uri.length - slashIndex > 18) slashIndex = uri.length;
                if (slashIndex - 4 > 19 + 3) uri = uri.slice(0, 19) + '<small class="message-overflow">' + uri.slice(19, slashIndex - 4) + '</small>' + uri.slice(slashIndex - 4);
            }
            return '<a href="' + fulluri +
                '" target="_blank" onclick="' + onclick + '">' + uri + '</a>';
        });

        // google [blah]
        //   Google search for 'blah'
        str = str.replace(/\bgoogle ?\[([^\]<]+)\]/gi, function(p0, p1) {
            p1 = escapeHTML(encodeURIComponent(unescapeHTML(p1)));
            return '<a href="http://www.google.com/search?ie=UTF-8&q=' + p1 +
                '" target="_blank">' + p0 + '</a>';
        });
        // wiki [blah]
        //   Search Wikipedia for 'blah' (and visit the article for 'blah' if it exists)
        str = str.replace(/\bwiki ?\[([^\]<]+)\]/gi, function(p0, p1) {
            p1 = escapeHTML(encodeURIComponent(unescapeHTML(p1)));
            return '<a href="http://en.wikipedia.org/w/index.php?title=Special:Search&search=' +
                p1 + '" target="_blank">' + p0 + '</a>';
        });
        // server issue #pullreq
        //   Links to github Pokemon Showdown server pullreq number
        str = str.replace(/\bserver issue ?#(\d+)/gi, function(p0, p1) {
            p1 = escapeHTML(encodeURIComponent(unescapeHTML(p1)));
            return '<a href="https://github.com/Zarel/Pokemon-Showdown/pull/' +
                p1 + '" target="_blank">' + p0 + '</a>';
        });
        // client issue #pullreq
        //   Links to github Pokemon Showdown client pullreq number
        str = str.replace(/\bclient issue ?#(\d+)/gi, function(p0, p1) {
            p1 = escapeHTML(encodeURIComponent(unescapeHTML(p1)));
            return '<a href="https://github.com/Zarel/Pokemon-Showdown-Client/pull/' +
                p1 + '" target="_blank">' + p0 + '</a>';
        });
        // [[blah]]
        //   Short form of gl[blah]
        str = str.replace(/\[\[([^< ](?:[^<`]*?[^< ])??)\]\]/gi, function(p0, p1) {
            var q = escapeHTML(encodeURIComponent(unescapeHTML(p1)));
            return '<a href="http://www.google.com/search?ie=UTF-8&btnI&q=' + q +
                '" target="_blank">' + p1 + '</a>';
        });

        // __italics__

        str = str.replace(/\_\_([^< ](?:[^<]*?[^< ])??)\_\_(?![^<]*?<\/a)/g, options.hideitalics ? '$1' : '<i>$1</i>');
        // **bold**
        str = str.replace(/\*\*([^< ](?:[^<]*?[^< ])??)\*\*/g, options.hidebold ? '$1' : '<b>$1</b>');
        if (!options.hidespoiler) {
            var untilIndex = 0;
            while (untilIndex < str.length) {
                var spoilerIndex = str.toLowerCase().indexOf('spoiler:', untilIndex);
                if (spoilerIndex < 0) spoilerIndex = str.toLowerCase().indexOf('spoilers:', untilIndex);
                if (spoilerIndex >= 0) {
                    untilIndex = str.indexOf('\n', spoilerIndex);
                    if (untilIndex < 0) untilIndex = str.length;
                    if (str.charAt(spoilerIndex - 1) === '(') {
                        var nextLParenIndex = str.indexOf('(', spoilerIndex);
                        var nextRParenIndex = str.indexOf(')', spoilerIndex);
                        if (nextRParenIndex < 0 || nextRParenIndex >= untilIndex) {
                            // no `)`, keep spoilering until next newline
                        }
                        else if (nextLParenIndex < 0 || nextLParenIndex > nextRParenIndex) {
                            // no `(` before next `)` - spoiler until next `)`
                            untilIndex = nextRParenIndex;
                        }
                        else {
                            // `(` before next `)` - just spoiler until the last `)`
                            untilIndex = str.lastIndexOf(')', untilIndex);
                            if (untilIndex < 0) untilIndex = str.length; // should never happen
                        }
                    }
                    var offset = spoilerIndex + 8;
                    if (str.charAt(offset) === ':') offset++;
                    if (str.charAt(offset) === ' ') offset++;
                    str = str.slice(0, offset) + '<span class="spoiler">' + str.slice(offset, untilIndex) + '</span>' + str.slice(untilIndex);
                    untilIndex += 29;
                }
                else {
                    break;
                }
            }
        }
        return str;
    }


    function unescapeHTML(str) {
        str = (str ? '' + str : '');
        return str.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    }

    sanitizeHTML = (function() {
        if (!('html4' in window)) {
            return function() {
                throw new Error('sanitizeHTML requires caja');
            };
        }
        // Add <marquee> and <blink> to the whitelist.
        // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/marquee
        // for the list of attributes.

        $.extend(html4.ELEMENTS, {
            'marquee': 0,
            'blink': 0
        });
        $.extend(html4.ATTRIBS, {
            'marquee::behavior': 0,
            'marquee::bgcolor': 0,
            'marquee::direction': 0,
            'marquee::height': 0,
            'marquee::hspace': 0,
            'marquee::loop': 0,
            'marquee::scrollamount': 0,
            'marquee::scrolldelay': 0,
            'marquee::truespeed': 0,
            'marquee::vspace': 0,
            'marquee::width': 0
        });
        var uriRewriter = function(uri) {
            return uri;
        };
        var tagPolicy = function(tagName, attribs) {
            if (html4.ELEMENTS[tagName] & html4.eflags['UNSAFE']) {
                return;
            }
            var targetIdx;
            var extra = {};
            if (tagName === 'a') {
                // Special handling of <a> tags.
                for (var i = 0; i < attribs.length - 1; i += 2) {
                    switch (attribs[i]) {
                        case 'target':
                            targetIdx = i + 1;
                            break;
                        case 'room':
                            // Special custom attribute for linking to a room.
                            // This attribute will be stripped by `sanitizeAttribs`
                            // below, and is only used to signal to add an `onclick`
                            // handler here.
                            if (!(/^[a-z0-9\-]*$/.test(attribs[i + 1]))) {
                                // Bogus roomid - could be used to inject JavaScript.
                                break;
                            }
                            extra['onclick'] = 'return selectTab(\'' + attribs[i + 1] + '\');';
                            break;
                    }
                }
            }
            attribs = html.sanitizeAttribs(tagName, attribs, uriRewriter);
            if (targetIdx !== undefined) {
                attribs[targetIdx] = '_blank';
            }
            else {
                extra['target'] = '_blank';
            }
            for (var i in extra) {
                attribs.push(i);
                attribs.push(extra[i]);
            }
            return {
                attribs: attribs
            };
        };
        return function(input) {
            return html.sanitizeWithPolicy(input, tagPolicy);
        };
    })()

    window.MD5 = function(f) {
        function i(b, c) {
            var d,
                e,
                f,
                g,
                h;
            f = b & 2147483648;
            g = c & 2147483648;
            d = b & 1073741824;
            e = c & 1073741824;
            h = (b & 1073741823) + (c & 1073741823);
            return d & e ? h ^ 2147483648 ^ f ^ g : d | e ? h & 1073741824 ? h ^ 3221225472 ^ f ^ g : h ^ 1073741824 ^ f ^ g : h ^ f ^ g
        }

        function j(b, c, d, e, f, g, h) {
            b = i(b, i(i(c & d | ~c & e, f), h));
            return i(b << g | b >>> 32 - g, c)
        }

        function k(b, c, d, e, f, g, h) {
            b = i(b, i(i(c & e | d & ~e, f), h));
            return i(b << g | b >>> 32 - g, c)
        }

        function l(b, c, e, d, f, g, h) {
            b = i(b, i(i(c ^ e ^ d, f), h));
            return i(b << g | b >>> 32 - g, c)
        }

        function m(b, c, e, d, f, g, h) {
            b = i(b, i(i(e ^ (c | ~d), f), h));
            return i(b << g | b >>> 32 - g, c)
        }

        function n(b) {
            var c = '',
                e = '',
                d;
            for (d = 0; d <= 3; d++) e = b >>> d * 8 & 255,
                e = '0' + e.toString(16),
                c += e.substr(e.length - 2, 2);
            return c
        }
        var g = [],
            o,
            p,
            q,
            r,
            b,
            c,
            d,
            e,
            f = function(b) {
                for (var b = b.replace(/\r\n/g, '\n'), c = '', e = 0; e < b.length; e++) {
                    var d = b.charCodeAt(e);
                    d < 128 ? c += String.fromCharCode(d) : (d > 127 && d < 2048 ? c += String.fromCharCode(d >> 6 | 192) : (c += String.fromCharCode(d >> 12 | 224), c += String.fromCharCode(d >> 6 & 63 | 128)), c += String.fromCharCode(d & 63 | 128))
                }
                return c
            }(f),
            g = function(b) {
                var c,
                    d = b.length;
                c =
                    d + 8;
                for (var e = ((c - c % 64) / 64 + 1) * 16, f = Array(e - 1), g = 0, h = 0; h < d;) c = (h - h % 4) / 4,
                    g = h % 4 * 8,
                    f[c] |= b.charCodeAt(h) << g,
                    h++;
                f[(h - h % 4) / 4] |= 128 << h % 4 * 8;
                f[e - 2] = d << 3;
                f[e - 1] = d >>> 29;
                return f
            }(f);
        b = 1732584193;
        c = 4023233417;
        d = 2562383102;
        e = 271733878;
        for (f = 0; f < g.length; f += 16) o = b,
            p = c,
            q = d,
            r = e,
            b = j(b, c, d, e, g[f + 0], 7, 3614090360),
            e = j(e, b, c, d, g[f + 1], 12, 3905402710),
            d = j(d, e, b, c, g[f + 2], 17, 606105819),
            c = j(c, d, e, b, g[f + 3], 22, 3250441966),
            b = j(b, c, d, e, g[f + 4], 7, 4118548399),
            e = j(e, b, c, d, g[f + 5], 12, 1200080426),
            d = j(d, e, b, c, g[f + 6], 17, 2821735955),
            c =
            j(c, d, e, b, g[f + 7], 22, 4249261313),
            b = j(b, c, d, e, g[f + 8], 7, 1770035416),
            e = j(e, b, c, d, g[f + 9], 12, 2336552879),
            d = j(d, e, b, c, g[f + 10], 17, 4294925233),
            c = j(c, d, e, b, g[f + 11], 22, 2304563134),
            b = j(b, c, d, e, g[f + 12], 7, 1804603682),
            e = j(e, b, c, d, g[f + 13], 12, 4254626195),
            d = j(d, e, b, c, g[f + 14], 17, 2792965006),
            c = j(c, d, e, b, g[f + 15], 22, 1236535329),
            b = k(b, c, d, e, g[f + 1], 5, 4129170786),
            e = k(e, b, c, d, g[f + 6], 9, 3225465664),
            d = k(d, e, b, c, g[f + 11], 14, 643717713),
            c = k(c, d, e, b, g[f + 0], 20, 3921069994),
            b = k(b, c, d, e, g[f + 5], 5, 3593408605),
            e = k(e, b, c, d, g[f + 10], 9, 38016083),
            d = k(d, e, b, c, g[f + 15], 14, 3634488961),
            c = k(c, d, e, b, g[f + 4], 20, 3889429448),
            b = k(b, c, d, e, g[f + 9], 5, 568446438),
            e = k(e, b, c, d, g[f + 14], 9, 3275163606),
            d = k(d, e, b, c, g[f + 3], 14, 4107603335),
            c = k(c, d, e, b, g[f + 8], 20, 1163531501),
            b = k(b, c, d, e, g[f + 13], 5, 2850285829),
            e = k(e, b, c, d, g[f + 2], 9, 4243563512),
            d = k(d, e, b, c, g[f + 7], 14, 1735328473),
            c = k(c, d, e, b, g[f + 12], 20, 2368359562),
            b = l(b, c, d, e, g[f + 5], 4, 4294588738),
            e = l(e, b, c, d, g[f + 8], 11, 2272392833),
            d = l(d, e, b, c, g[f + 11], 16, 1839030562),
            c = l(c, d, e, b, g[f + 14], 23, 4259657740),
            b = l(b, c, d, e, g[f + 1], 4, 2763975236),
            e = l(e, b, c, d, g[f + 4], 11, 1272893353),
            d = l(d, e, b, c, g[f + 7], 16, 4139469664),
            c = l(c, d, e, b, g[f + 10], 23, 3200236656),
            b = l(b, c, d, e, g[f + 13], 4, 681279174),
            e = l(e, b, c, d, g[f + 0], 11, 3936430074),
            d = l(d, e, b, c, g[f + 3], 16, 3572445317),
            c = l(c, d, e, b, g[f + 6], 23, 76029189),
            b = l(b, c, d, e, g[f + 9], 4, 3654602809),
            e = l(e, b, c, d, g[f + 12], 11, 3873151461),
            d = l(d, e, b, c, g[f + 15], 16, 530742520),
            c = l(c, d, e, b, g[f + 2], 23, 3299628645),
            b = m(b, c, d, e, g[f + 0], 6, 4096336452),
            e = m(e, b, c, d, g[f + 7], 10, 1126891415),
            d = m(d, e, b, c, g[f + 14], 15, 2878612391),
            c = m(c, d, e, b, g[f + 5], 21, 4237533241),
            b = m(b, c, d, e, g[f + 12], 6, 1700485571),
            e = m(e, b, c, d, g[f + 3], 10, 2399980690),
            d = m(d, e, b, c, g[f + 10], 15, 4293915773),
            c = m(c, d, e, b, g[f + 1], 21, 2240044497),
            b = m(b, c, d, e, g[f + 8], 6, 1873313359),
            e = m(e, b, c, d, g[f + 15], 10, 4264355552),
            d = m(d, e, b, c, g[f + 6], 15, 2734768916),
            c = m(c, d, e, b, g[f + 13], 21, 1309151649),
            b = m(b, c, d, e, g[f + 4], 6, 4149444226),
            e = m(e, b, c, d, g[f + 11], 10, 3174756917),
            d = m(d, e, b, c, g[f + 2], 15, 718787259),
            c = m(c, d, e, b, g[f + 9], 21, 3951481745),
            b = i(b, o),
            c = i(c, p),
            d = i(d, q),
            e = i(e, r);
        return (n(b) + n(c) + n(d) + n(e)).toLowerCase()
    };

    var domainRegex = '[a-z0-9\\-]+(?:[.][a-z0-9\\-]+)*';
    var parenthesisRegex = '[(](?:[^\\s()<>&]|&amp;)*[)]';
    var linkRegex = new RegExp('\\b' +
        '(?:' +
        '(?:' +
        // When using www. or http://, allow any-length TLD (like .museum)
        '(?:https?://|www[.])' + domainRegex +
        '|' + domainRegex + '[.]' +
        // Allow a common TLD, or any 2-3 letter TLD followed by : or /
        '(?:com?|org|net|edu|info|us|jp|[a-z]{2,3}(?=[:/]))' +
        ')' +
        '(?:[:][0-9]+)?' +
        '\\b' +
        '(?:' +
        '/' +
        '(?:' +
        '(?:' +
        '[^\\s()&]|&amp;|&quot;' +
        '|' + parenthesisRegex +
        ')*' +
        // URLs usually don't end with punctuation, so don't allow
        // punctuation symbols that probably aren't related to URL.
        '(?:' +
        '[^\\s`()\\[\\]{}\'".,!?;:&]' +
        '|' + parenthesisRegex +
        ')' +
        ')?' +
        ')?' +
        '|[a-z0-9.]+\\b@' + domainRegex + '[.][a-z]{2,3}' +
        ')', 'ig'
    );

}).call(this, jQuery);