/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js';

const { Launch } = require('minecraft-java-core');
const { shell, ipcRenderer } = require('electron');

class Home {
    static id = "home";

    async init(config) {
        this.config = config;
        this.db = new database();
        this.news();
        this.socialLick();
        await this.instancesSelect(); // Appel modifié pour charger les instances
        await this.fetchModpackVersion();
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'));
    }

    async fetchModpackVersion() {
        try {
            const response = await fetch("http://launcher.dium-corp.com/launcher/config-launcher/config.json");
            if (!response.ok) throw new Error("Erreur lors de la récupération de la version du modpack.");
            
            const data = await response.json();
            const versionElement = document.getElementById("modpack-version");
            versionElement.textContent = data.modpack_version || "Version non spécifiée";
            return data.status; // Retourne les informations du serveur
        } catch (error) {
            console.error("Erreur:", error);
            document.getElementById("modpack-version").textContent = "Erreur de chargement";
        }
    }

    async getDefaultInstance() {
        try {
            const response = await fetch("http://launcher.dium-corp.com/launcher/config-launcher/config.json");
            if (!response.ok) throw new Error("Erreur lors de la récupération des informations d'instance.");
            
            const data = await response.json();
            return data.defaultInstance || null; // Retourne l'instance par défaut si elle existe
        } catch (error) {
            console.error("Erreur:", error);
            return null; // En cas d'erreur, retourner null
        }
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        let news = await config.getNews().then(res => res).catch(err => false);
        
        if (news) {
            if (!news.length) {
                let blockNews = document.createElement('div');
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">Aucun news n'ai actuellement disponible.</div>
                        </div>
                        <div class="date">
                            <div class="day">1</div>
                            <div class="month">Janvier</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Vous pourrez suivre ici toutes les news relative au serveur.</p>
                        </div>
                    </div>`;
                newsElement.appendChild(blockNews);
            } else {
                for (let News of news) {
                    let date = this.getdate(News.publish_date);
                    let blockNews = document.createElement('div');
                    blockNews.classList.add('news-block');
                    blockNews.innerHTML = `
                        <div class="news-header">
                            <img class="server-status-icon" src="assets/images/icon.png">
                            <div class="header-text">
                                <div class="title">${News.title}</div>
                            </div>
                            <div class="date">
                                <div class="day">${date.day}</div>
                                <div class="month">${date.month}</div>
                            </div>
                        </div>
                        <div class="news-content">
                            <div class="bbWrapper">
                                <p>${News.content.replace(/\n/g, '</br>')}</p>
                                <p class="news-author">Auteur - <span>${News.author}</span></p>
                            </div>
                        </div>`;
                    newsElement.appendChild(blockNews);
                }
            }
        } else {
            let blockNews = document.createElement('div');
            blockNews.classList.add('news-block');
            blockNews.innerHTML = `
                <div class="news-header">
                    <img class="server-status-icon" src="assets/images/icon.png">
                    <div class="header-text">
                        <div class="title">Error.</div>
                    </div>
                    <div class="date">
                        <div class="day">1</div>
                        <div class="month">Janvier</div>
                    </div>
                </div>
                <div class="news-content">
                    <div class="bbWrapper">
                        <p>Impossible de contacter le serveur des news.</br>Merci de vérifier votre configuration.</p>
                    </div>
                </div>`;
            newsElement.appendChild(blockNews);
        }
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block');

        socials.forEach(social => {
            social.addEventListener('click', e => {
                shell.openExternal(e.target.dataset.url);
            });
        });
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient');
        let auth = await this.db.readData('accounts', configClient.account_selected);
        let instancesList = await config.getInstanceList();

        // Récupérer l'instance par défaut depuis le fichier JSON
        let defaultInstance = await this.getDefaultInstance();

        // Vérifier si l'instance par défaut existe dans la liste des instances
        let instanceSelect = instancesList.find(i => i.name === defaultInstance) ? defaultInstance : null;

        let instanceBTN = document.querySelector('.play-instance');
        let instancePopup = document.querySelector('.instance-popup');
        let instancesListPopup = document.querySelector('.instances-List');
        let instanceCloseBTN = document.querySelector('.close-popup');

        if (instancesList.length === 1) {
            document.querySelector('.instance-select').style.display = 'none';
            instanceBTN.style.paddingRight = '0';
        }

        // Si aucune instance n'est sélectionnée, sélectionner l'instance par défaut
        if (!instanceSelect) {
            instanceSelect = defaultInstance; // Utiliser l'instance par défaut
            configClient.instance_selct = instanceSelect; // Mettre à jour la configuration du client
            await this.db.updateData('configClient', configClient); // Enregistrer la sélection dans la base de données
        }

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == auth?.name);
                if (whitelist !== auth?.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false);
                        configClient.instance_selct = newInstanceSelect.name;
                        instanceSelect = newInstanceSelect.name;
                        setStatus(newInstanceSelect.status);
                        await this.db.updateData('configClient', configClient);
                    }
                }
            } else console.log(`Initializing instance ${instance.name}...`);
            if (instance.name == instanceSelect) setStatus(instance.status);
        }

        instancePopup.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient');

            if (e.target.classList.contains('instance-elements')) {
                let newInstanceSelect = e.target.id;
                let activeInstanceSelect = document.querySelector('.active-instance');

                if (activeInstanceSelect) activeInstanceSelect.classList.toggle('active-instance');
                e.target.classList.add('active-instance');

                configClient.instance_selct = newInstanceSelect;
                await this.db.updateData('configClient', configClient);
                instanceSelect = instancesList.filter(i => i.name == newInstanceSelect);
                instancePopup.style.display = 'none';
                let instanceOptions = await config.getInstanceList();
                let options = instanceOptions.find(i => i.name == configClient.instance_selct);
                await setStatus(options.status);
            }
        });

        instanceBTN.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient');
            let selectedInstanceName = configClient.instance_selct;
            let auth = await this.db.readData('accounts', configClient.account_selected);

            if (e.target.classList.contains('instance-select')) {
                instancesListPopup.innerHTML = '';
                for (let instance of instancesList) {
                    if (instance.whitelistActive) {
                        instance.whitelist.map(whitelist => {
                            if (whitelist == auth?.name) {
                                if (instance.name == selectedInstanceName) {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`;
                                } else {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`;
                                }
                            }
                        });
                    } else {
                        if (instance.name == selectedInstanceName) {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`;
                        } else {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`;
                        }
                    }
                }

                instancePopup.style.display = 'flex';
            }

            if (!e.target.classList.contains('instance-select')) this.startGame(); // Appel à startGame
        });

        instanceCloseBTN.addEventListener('click', () => instancePopup.style.display = 'none');
    }

    async startGame() {
        let launch = new Launch();
        
        // Récupérer les options de l'instance sélectionnée
        let configClient = await this.db.readData('configClient');
        
        // Vérifier que l'option existe avant d'y accéder
        let optionsList = await config.getInstanceList();
        
        // Vérifier si options est défini
        let options = optionsList.find(i => i.name === configClient.instance_selct);

        // Vérification si options est défini
        if (!options) {
            console.error("Options non définies pour l'instance sélectionnée.");
            alert("Veuillez sélectionner une instance avant de démarrer le jeu."); // Alerte pour informer l'utilisateur
            return; // Arrêtez l'exécution si options est indéfini
        }

       // Récupérer les informations nécessaires pour le lancement
       let playInstanceBTN = document.querySelector('.play-instance');
       let infoStartingBOX = document.querySelector('.info-starting-game');
       let infoStarting = document.querySelector(".info-starting-game-text");
       let progressBar = document.querySelector('.progress-bar');

       let opt = {
           url: options.url,
           authenticator: await this.db.readData('accounts', configClient.account_selected),
           timeout: 10000,
           path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
           instance: options.name,
           version: options.loadder.minecraft_version,
           detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
           downloadFileMultiple: configClient.launcher_config.download_multi,
           intelEnabledMac: configClient.launcher_config.intelEnabledMac,

           loader: {
               type: options.loadder.loadder_type,
               build: options.loadder.loadder_version,
               enable: options.loadder.loadder_type == 'none' ? false : true
           },

           verify: options.verify,

           ignored: [...options.ignored],

           javaPath: configClient.java_config.java_path,

           screen: {
               width: configClient.game_config.screen_size.width,
               height: configClient.game_config.screen_size.height
           },

           memory: {
               min: `${configClient.java_config.java_memory.min * 1024}M`,
               max: `${configClient.java_config.java_memory.max * 1024}M`
           }
       };

       launch.Launch(opt);

       playInstanceBTN.style.display = "none";
       infoStartingBOX.style.display = "block";
       
       progressBar.style.display = "";
       
       ipcRenderer.send('main-window-progress-load');

       launch.on('extract', extract => {
           ipcRenderer.send('main-window-progress-load');
           console.log(extract);
       });

       launch.on('progress', (progress, size) => {
           infoStarting.innerHTML = `Téléchargement ${((progress / size) * 100).toFixed(0)}%`;
           
           ipcRenderer.send('main-window-progress', { progress, size });
           
           progressBar.value = progress;
           progressBar.max = size;
       });

       launch.on('check', (progress, size) => {
           infoStarting.innerHTML = `Vérification ${((progress / size) * 100).toFixed(0)}%`;
           
           ipcRenderer.send('main-window-progress', { progress, size });
           
           progressBar.value = progress;
           progressBar.max = size;
       });

       launch.on('estimated', (time) => {
           const hours   = Math.floor(time / 3600);
           const minutes = Math.floor((time - hours * 3600) / 60);
           const seconds = Math.floor(time - hours * 3600 - minutes * 60);
           console.log(`${hours}h ${minutes}m ${seconds}s`);
       });

       launch.on('speed', (speed) => {
           console.log(`${(speed / 1067008).toFixed(2)} Mb/s`);
       });

       launch.on('patch', patch => {
           console.log(patch);
           ipcRenderer.send('main-window-progress-load')
           infoStarting.innerHTML = `Patch en cours...`;
       });

       launch.on('data', (e) => {
           progressBar.style.display = "none";
           if (configClient.launcher_config.closeLauncher == 'close-launcher') {
               ipcRenderer.send("main-window-hide");
           };
           new logger('Minecraft', '#36b030');
           ipcRenderer.send('main-window-progress-load')
           infoStarting.innerHTML = `Demarrage en cours...`;
           console.log(e);
       });

       launch.on('close', code => {
           if (configClient.launcher_config.closeLauncher == 'close-launcher') {
               ipcRenderer.send("main-window-show");
           };
           ipcRenderer.send('main-window-progress-reset')
           infoStartingBOX.style.display = "none";
           playInstanceBTN.style.display = "flex";
           infoStarting.innerHTML = `Vérification`;
           new logger(pkg.name, '#7289da');
           console.log('Close');
       });

       launch.on('error', err => {
           const popupError = new popup();

           popupError.openPopup({
               title: 'Erreur',
               content: err.error,
               color: 'red',
               options: true
           });

           if (configClient.launcher_config.closeLauncher == 'close-launcher') {
               ipcRenderer.send("main-window-show");
           };
           
           ipcRenderer.send('main-window-progress-reset')
           infoStartingBOX.style.display = "none";
           playInstanceBTN.style.display = "flex";
           infoStarting.innerHTML = `Vérification`;
           
           new logger(pkg.name, '#7289da');
           console.log(err);
       });
    }

    getdate(e) {
         const date = new Date(e)
         const year = date.getFullYear()
         const month = date.getMonth() + 1
         const day = date.getDate()
         
         const allMonth = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
         
         return { year: year, month: allMonth[month - 1], day: day };
     }
}

export default Home;