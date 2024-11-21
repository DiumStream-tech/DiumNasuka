/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const pkg = require('../package.json');
const nodeFetch = require("node-fetch");
const convert = require('xml-js');
let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url

let configPath = `${url}/launcher/config-launcher/config.json`;

class Config {
    async GetConfig() {
        try {
            const response = await nodeFetch(configPath);
            if (response.status === 200) {
                return await response.json();
            } else {
                throw new Error('server not accessible');
            }
        } catch (error) {
            throw error;
        }
    }

    async getInstanceList() {
        let urlInstance = `${url}/files`
        let instances = await nodeFetch(urlInstance).then(res => res.json()).catch(err => err)
        let instancesList = []
        instances = Object.entries(instances)

        for (let [name, data] of instances) {
            let instance = data
            instance.name = name
            instancesList.push(instance)
        }
        return instancesList
    }

    async getNews() {
        try {
            const config = await this.GetConfig();
            const rssUrl = config.rss;
            
            if (!rssUrl) {
                throw new Error('RSS URL not found in config');
            }

            const response = await nodeFetch(rssUrl);
            if (response.status === 200) {
                const xmlText = await response.text();
                const jsonData = JSON.parse(convert.xml2json(xmlText, { compact: true }));
                const items = jsonData.rss.channel.item;

                return Array.isArray(items) ? items.map(item => ({
                    title: item.title._text,
                    content: item['content:encoded']._text,
                    author: item['dc:creator']._text,
                    publish_date: item.pubDate._text
                })) : [];
            } else {
                throw new Error('server not accessible');
            }
        } catch (error) {
            throw error;
        }
    }
}

export default new Config;