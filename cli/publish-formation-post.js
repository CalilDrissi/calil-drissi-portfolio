// Publish the "Formation Nouvelles Technologies" blog post in French
const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(l => { const [k,v] = l.split('='); if (k && v) env[k.trim()] = v.trim(); });
const WP_URL = env.WP_URL;
const WP_USER = env.WP_USER;
const WP_APP_PASSWORD = env.WP_APP_PASSWORD;
const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

async function wpAPI(method, endpoint, body) {
  const url = `${WP_URL}/wp-json/wp/v2/${endpoint}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function getOrCreateTerm(taxonomy, name) {
  const search = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`);
  const found = search.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  try {
    const created = await wpAPI('POST', taxonomy, { name });
    return created.id;
  } catch (e) {
    const retry = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`);
    const f = retry.find(t => t.name.toLowerCase() === name.toLowerCase());
    return f ? f.id : null;
  }
}

async function uploadFeaturedImage() {
  try {
    // Use LoremFlickr for a relevant image
    const imageUrl = 'https://loremflickr.com/1200/630/morocco,business,digital?lock=42';
    const imgRes = await fetch(imageUrl, { redirect: 'follow' });
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `formation-nouvelles-technologies-pme-maroc-${Date.now()}.jpg`;

    const uploadRes = await fetch(`${WP_URL}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'image/jpeg',
      },
      body: buffer,
    });
    const media = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Upload failed: ${JSON.stringify(media)}`);
    await wpAPI('POST', `media/${media.id}`, {
      alt_text: 'Formation Nouvelles Technologies pour PME et TPE au Maroc — transformation digitale'
    });
    console.log(`  ✓ Featured image uploaded (ID: ${media.id})`);
    return media.id;
  } catch (e) {
    console.warn(`  ⚠ Featured image failed: ${e.message}`);
    return null;
  }
}

// ── Blog post content ──

const title = 'Formation : Transformer son Entreprise grâce aux Nouvelles Technologies — Guide pour PME/TPE au Maroc';
const slug = 'formation-nouvelles-technologies-pme-maroc';
const excerpt = 'Vous dirigez une PME ou TPE au Maroc et la transformation digitale vous semble complexe ? Cette formation pratique de 9 modules vous donne les outils concrets pour digitaliser votre activité, attirer des clients en ligne et respecter le cadre juridique marocain.';

const content = `
<p><strong>SEO Title:</strong> Formation Nouvelles Technologies PME Maroc — Transformation Digitale 2026</p>
<p><strong>Meta description:</strong> Formation pratique pour PME/TPE au Maroc : marketing digital, e-commerce, IA, cybersécurité et cadre juridique. 9 modules concrets pour transformer votre entreprise.</p>

<hr />

<p>Vous avez une entreprise qui tourne. Des clients fidèles, une réputation locale solide, un savoir-faire réel. Mais depuis quelques mois, vous voyez vos concurrents apparaître sur Instagram, recevoir des commandes via WhatsApp, et vous vous demandez : <strong>est-ce que je suis en train de prendre du retard ?</strong></p>

<p>La réponse courte : probablement oui. Mais la bonne nouvelle, c'est que le retard se rattrape — à condition de savoir par où commencer.</p>

<p>C'est exactement pour ça que j'ai conçu cette formation. Pas un séminaire théorique avec des slides PowerPoint déconnectés de la réalité marocaine. Un programme <strong>pratique, concret, et adapté au contexte des PME et TPE au Maroc</strong>.</p>

<h2>Pourquoi maintenant ? Parce que le Maroc n'attend pas</h2>

<p>On n'est plus en 2019. Le paysage a radicalement changé :</p>

<ul>
<li><strong>La facturation électronique devient obligatoire en 2026</strong> — la DGI ne plaisante plus. Si votre comptabilité est encore sur Excel, il est temps d'agir.</li>
<li><strong>La CNDP applique la loi 09-08</strong> sur la protection des données personnelles. Vous collectez des emails clients ? Vous avez un fichier Excel avec des numéros de téléphone ? Vous êtes concerné.</li>
<li><strong>Le e-commerce marocain croît de +30% par an.</strong> Vos clients achètent déjà en ligne — la question, c'est : chez vous ou chez un concurrent ?</li>
<li><strong>L'IA est devenue accessible à tout le monde.</strong> ChatGPT, Canva avec IA, les outils d'automatisation… Ce n'est plus réservé aux grandes entreprises de Casablanca.</li>
<li><strong>La stratégie Maroc Digital</strong> et le plan <strong>Maroc IA 2030</strong> poussent la digitalisation à tous les niveaux. Les entreprises qui n'y vont pas seront les dernières de la file.</li>
</ul>

<p>La fenêtre d'opportunité est ouverte. Mais elle ne le restera pas éternellement.</p>

<h2>Ce que vous allez apprendre — concrètement</h2>

<p>9 modules. Chacun pensé pour répondre à un vrai problème que rencontrent les chefs d'entreprise marocains au quotidien.</p>

<h3>1. Comprendre le terrain de jeu</h3>
<p>Où en est le Maroc dans sa transformation digitale ? Quelles sont les opportunités sectorielles ? Qu'est-ce que Maroc Digital et Maroc IA 2030 changent concrètement pour votre business ? On pose le cadre avant d'agir.</p>

<h3>2. Attirer vos premiers clients en ligne — sans exploser votre budget</h3>
<p>SEO pour que Google vous trouve, Instagram et Facebook pour votre visibilité, WhatsApp Business pour convertir, Google Business Profile pour le local. On voit aussi comment l'IA peut créer du contenu marketing en quelques minutes au lieu de quelques jours.</p>

<h3>3. Vendre autrement : e-commerce, marketplaces et produits digitaux</h3>
<p>Faut-il un site e-commerce ? Ou vaut-il mieux commencer par Jumia, Avito, voire Etsy ou Amazon pour l'export ? Comment mettre en place un CRM simple pour ne plus perdre de prospects ? On explore chaque canal avec ses avantages et ses pièges.</p>

<h3>4. Développer votre réseau à l'ère digitale</h3>
<p>LinkedIn n'est pas juste un CV en ligne. C'est un outil de prospection redoutable quand on sait l'utiliser. On voit aussi comment intégrer l'écosystème entrepreneurial marocain — les communautés, les événements hybrides, les partenariats stratégiques.</p>

<h3>5. Travailler plus intelligemment, pas plus longtemps</h3>
<p>Outils collaboratifs, automatisation sans code, comptabilité digitale… Et surtout : comment utiliser l'IA comme assistant quotidien pour gagner 2 à 3 heures par jour sur les tâches répétitives. Oui, c'est possible.</p>

<h3>6. Gérer vos équipes à l'ère du digital</h3>
<p>Recruter en ligne, former vos collaborateurs avec le e-learning, gérer le télétravail et les équipes hybrides. Le management a changé — votre approche doit suivre.</p>

<h3>7. Connaître le cadre juridique — pour éviter les mauvaises surprises</h3>
<p>Loi 09-08 (CNDP), loi 31-08 (protection du consommateur), facturation électronique obligatoire, loi 05-20 sur la cybersécurité, <a href="https://directentreprise.ma" target="_blank" rel="noopener">directentreprise.ma</a>… Ce module vous évite les amendes et les problèmes. Pas glamour, mais indispensable.</p>

<h3>8. Protéger votre entreprise des menaces numériques</h3>
<p>Phishing, ransomware, vol de données… Les PME sont les cibles préférées des cybercriminels parce qu'elles se protègent moins. On voit les gestes essentiels, quoi faire en cas d'attaque, et si la cyber-assurance vaut le coup.</p>

<h3>9. Repartir avec un plan d'action concret</h3>
<p>Pas de "on verra plus tard". Vous faites votre auto-diagnostic de maturité digitale, vous priorisez les actions par effort/impact, et vous repartez avec un <strong>plan d'action sur 30 jours</strong>. Le lundi suivant la formation, vous savez exactement quoi faire.</p>

<h2>C'est pour qui, exactement ?</h2>

<p>Cette formation s'adresse à vous si :</p>

<ul>
<li>Vous dirigez une <strong>PME ou TPE au Maroc</strong> — commerce, services, artisanat, restauration, conseil…</li>
<li>Vous êtes <strong>freelance ou auto-entrepreneur</strong> et vous voulez structurer votre présence digitale</li>
<li>Vous êtes <strong>manager ou responsable</strong> chargé de la transition numérique dans votre entreprise</li>
<li>Vous savez que <strong>le digital est important</strong> mais vous vous sentez dépassé par les options</li>
</ul>

<p><strong>Aucun prérequis technique.</strong> Si vous savez utiliser un smartphone et envoyer un email, vous avez le niveau. Le reste, on l'apprend ensemble.</p>

<h2>Pourquoi cette formation est différente</h2>

<p>Des formations sur le digital, il y en a des centaines en ligne. Alors pourquoi celle-ci ?</p>

<p><strong>Parce qu'elle est faite pour le Maroc.</strong> Pas pour le marché américain ou européen. On parle de CMI, pas de Stripe. De la CNDP, pas du RGPD. De WhatsApp Business, pas de Slack. Les exemples, les outils, les lois — tout est contextualisé.</p>

<p><strong>Parce qu'elle est pratique.</strong> Chaque module inclut des exercices, des démonstrations en direct, et des cas concrets de PME marocaines. Pas de théorie abstraite.</p>

<p><strong>Parce qu'elle est donnée par un praticien.</strong> Je ne suis pas un consultant qui vend des slides. Je suis entrepreneur, je développe des produits, je gère des projets digitaux au quotidien. Ce que j'enseigne, c'est ce que j'applique.</p>

<p><strong>Parce que vous repartez avec un plan.</strong> Pas une inspiration vague. Un document concret avec vos priorités, vos premières actions, et un calendrier sur 30 jours.</p>

<h2>Est-ce que votre entreprise peut se permettre d'attendre ?</h2>

<p>La digitalisation n'est plus un luxe réservé aux grandes entreprises. C'est devenu une question de survie pour les PME. Les clients cherchent sur Google avant de se déplacer. Ils comparent sur Instagram avant d'acheter. Ils paient par CMI ou carte bancaire plus souvent qu'en cash.</p>

<p>Chaque mois que vous attendez, c'est un mois où vos concurrents avancent et où vos clients potentiels vont ailleurs.</p>

<h2>Passez à l'action</h2>

<p>Les places sont limitées pour garantir un accompagnement de qualité. Si vous voulez transformer votre entreprise avec des outils concrets et un plan adapté à votre réalité marocaine, c'est le moment.</p>

<p>👉 <strong><a href="[LIEN D'INSCRIPTION]">Inscrivez-vous maintenant</a></strong> ou contactez-moi directement pour plus d'informations.</p>

<p>On se voit en formation.</p>

<p><em>— Cal</em></p>
`;

const tags = [
  'Formation',
  'Transformation Digitale',
  'PME Maroc',
  'TPE',
  'Marketing Digital',
  'E-commerce Maroc',
  'Cybersécurité',
  'IA pour entreprises',
];

const categories = ['Formation', 'Business'];

async function main() {
  console.log('Publishing formation blog post...\n');

  // Get/create tags
  console.log('  Creating tags...');
  const tagIds = [];
  for (const tag of tags) {
    const id = await getOrCreateTerm('tags', tag);
    if (id) tagIds.push(id);
  }
  console.log(`  ✓ ${tagIds.length} tags ready`);

  // Get/create categories
  console.log('  Creating categories...');
  const catIds = [];
  for (const cat of categories) {
    const id = await getOrCreateTerm('categories', cat);
    if (id) catIds.push(id);
  }
  console.log(`  ✓ ${catIds.length} categories ready`);

  // Upload featured image
  console.log('  Uploading featured image...');
  const imageId = await uploadFeaturedImage();

  // Create post
  console.log('  Publishing post...');
  const postData = {
    title,
    slug,
    content,
    excerpt,
    status: 'publish',
    categories: catIds,
    tags: tagIds,
    lang: 'fr',
  };
  if (imageId) postData.featured_media = imageId;

  const post = await wpAPI('POST', 'posts', postData);
  console.log(`\n  ✓ Published: ${post.link}`);
  console.log(`    ID: ${post.id}`);
  console.log(`    Slug: ${post.slug}`);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
