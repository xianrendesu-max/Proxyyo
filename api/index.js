const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
    const { u } = req.query;
    if (!u) return res.status(400).send('No URL provided');

    try {
        const targetUrl = Buffer.from(u, 'base64').toString('utf-8');
        const urlObj = new URL(targetUrl);

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                'User-Agent': req.headers['user-agent'],
                'Cookie': req.headers.cookie || '',
                'Referer': urlObj.origin
            },
            responseType: 'arraybuffer',
            validateStatus: false
        });

        // Cookieのドメイン書き換え
        if (response.headers['set-cookie']) {
            const cookies = response.headers['set-cookie'].map(c => 
                c.replace(/Domain=[^;]+;?/gi, '').replace(/Secure/gi, '')
            );
            res.setHeader('Set-Cookie', cookies);
        }

        // セキュリティヘッダーの解除
        delete response.headers['content-security-policy'];
        delete response.headers['x-frame-options'];
        delete response.headers['content-encoding'];
        
        Object.keys(response.headers).forEach(key => {
            res.setHeader(key, response.headers[key]);
        });

        const contentType = response.headers['content-type'] || '';

        if (contentType.includes('text/html')) {
            let $ = cheerio.load(response.data.toString());
            $('head').prepend(`<base href="${targetUrl}">`);
            
            const rewrite = (tag, attr) => {
                $(tag).each((i, el) => {
                    const val = $(el).attr(attr);
                    if (val && !val.startsWith('data:') && !val.startsWith('#')) {
                        try {
                            const abs = new URL(val, targetUrl).href;
                            $(el).attr(attr, `/p?u=${Buffer.from(abs).toString('base64')}`);
                        } catch(e) {}
                    }
                });
            };

            ['a', 'link', 'script', 'img', 'form'].forEach(t => rewrite(t, t === 'a' || t === 'link' ? 'href' : (t === 'form' ? 'action' : 'src')));
            return res.send($.html());
        }

        res.send(response.data);
    } catch (e) {
        res.status(500).send('Proxy Error: ' + e.message);
    }
};
