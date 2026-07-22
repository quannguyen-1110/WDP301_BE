const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const User = require('../models/User');
const Series = require('../models/Series');
const Chapter = require('../models/Chapter');
const Page = require('../models/Page');
const Task = require('../models/Task');
const Proposal = require('../models/SeriesProposal');
const Submission = require('../models/SeriesSubmission');
const Vote = require('../models/Vote');
const Rating = require('../models/Rating');
const Ranking = require('../models/Ranking');
const SeriesRank = require('../models/SeriesRank');
const Notification = require('../models/Notification');
const Earning = require('../models/AssistantEarning');
const Annotation = require('../models/Annotation');
const AuditLog = require('../models/AuditLog');

const PASSWORD = process.env.DEMO_SEED_PASSWORD || crypto.randomBytes(18).toString('base64url');
const EMAILS = ['admin@test.com','mangaka@test.com','mangaka2@test.com','assistant@test.com','assistant2@test.com','editor@test.com','board@test.com','board1@test.com','board2@test.com','board3@test.com'];
const LEGACY_CATALOG_TITLES = [
  'One Piece - Vua Hai Tac','Dragon Ball - Bay Vien Ngoc Rong','Kochikame - Canh Sat Ky Tai',
  'Tham Tu Lung Danh Conan','Slam Dunk - Cao Thu Bong Ro','Tetsuwan Atomu - Sieu Nhi Astro',
  'Doraemon','Hokuto No Ken - Bac Dau Than Quyen','Touch - Cham Toi',
  'Hajime no Ippo - Vo Si Quyen Anh Ippo',"JoJo's Bizarre Adventure - Cuoc Phieu Luu Bi An"
];
const CATALOG_TITLES = [
  'One Piece – Vua Hải Tặc', 'Dragon Ball – Bảy Viên Ngọc Rồng', 'Naruto',
  'Kochikame – Cảnh Sát Kỳ Tài', 'Thám Tử Lừng Danh Conan', 'Slam Dunk – Cao Thủ Bóng Rổ',
  'Tetsuwan Atomu – Siêu Nhí Astro', 'Doraemon – Đôrêmon', 'Hokuto no Ken – Bắc Đẩu Thần Quyền',
  'Touch – Chạm Tới', 'Hajime no Ippo – Võ Sĩ Quyền Anh Ippo',
  "JoJo's Bizarre Adventure – Cuộc Phiêu Lưu Bí Ẩn"
];
const TITLES = [
  'Neon Ronin: Last Signal','Whispers of the Moon Garden','Crimson Harbor','Clockwork Familiar',
  'The Ninth Lantern','Skyline Runners','Paper Kingdom','Echoes Beneath the Rain',
  'Dragon Slayer Chronicles','Cyber Ronin 2099','Moonlit Garden','FPT123FPT','TEST3','TEST THU',
  ...CATALOG_TITLES,...LEGACY_CATALOG_TITLES
];
const plusDays = (n) => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d; };
const pic = (seed,w=800,h=1200) => 'https://picsum.photos/seed/manga-'+seed+'/'+w+'/'+h;

async function cleanDemo() {
  const demoUsers = await User.find({email:{$in:EMAILS}}).select('_id email');
  const userIds = demoUsers.map(x=>x._id);
  const seriesIds = (await Series.find({title:{$in:TITLES}}).select('_id')).map(x=>x._id);
  const proposalIds = (await Proposal.find({$or:[{title:{$in:TITLES}},...(seriesIds.length?[{seriesId:{$in:seriesIds}}]:[])]}).select('_id')).map(x=>x._id);
  const chapterIds = seriesIds.length ? (await Chapter.find({seriesId:{$in:seriesIds}}).select('_id')).map(x=>x._id) : [];
  const pageIds = chapterIds.length ? (await Page.find({chapterId:{$in:chapterIds}}).select('_id')).map(x=>x._id) : [];
  const filters=[];
  if(seriesIds.length)filters.push({seriesId:{$in:seriesIds}});
  if(proposalIds.length)filters.push({proposalId:{$in:proposalIds}});
  if(chapterIds.length)filters.push({chapterId:{$in:chapterIds}});
  const submissionIds = filters.length ? (await Submission.find({$or:filters}).select('_id')).map(x=>x._id) : [];
  if(submissionIds.length)await Vote.deleteMany({submissionId:{$in:submissionIds}});
  if(submissionIds.length)await Submission.deleteMany({_id:{$in:submissionIds}});
  if(pageIds.length)await Annotation.deleteMany({pageId:{$in:pageIds}});
  if(seriesIds.length||chapterIds.length){
    const taskFilters=[];
    if(seriesIds.length)taskFilters.push({seriesId:{$in:seriesIds}});
    if(chapterIds.length)taskFilters.push({chapterId:{$in:chapterIds}});
    await Task.deleteMany({$or:taskFilters});
  }
  if(pageIds.length)await Page.deleteMany({_id:{$in:pageIds}});
  if(chapterIds.length)await Chapter.deleteMany({_id:{$in:chapterIds}});
  if(seriesIds.length)await Promise.all([Rating.deleteMany({seriesId:{$in:seriesIds}}),Ranking.deleteMany({seriesId:{$in:seriesIds}}),SeriesRank.deleteMany({seriesId:{$in:seriesIds}})]);
  if(proposalIds.length)await Proposal.deleteMany({_id:{$in:proposalIds}});
  if(userIds.length){
    const month=new Date().toISOString().slice(0,7);
    await Promise.all([
      Earning.deleteMany({assistantId:{$in:userIds},month}),
      Notification.deleteMany({userId:{$in:userIds},title:{$in:['Chapter approved','Board vote in progress','New task assigned','Payment summary ready','Manuscript submitted','Vote required']}}),
      AuditLog.deleteMany({userId:{$in:userIds},action:'Seeded demo catalogue'})
    ]);
  }
  if(seriesIds.length)await Series.deleteMany({_id:{$in:seriesIds}});
  return {preservedUsers:userIds.length,series:seriesIds.length,chapters:chapterIds.length,pages:pageIds.length};
}
async function createUsers(){
  const specs=[
    ['Studio Admin','admin@test.com','ADMIN','admin'],['Hana Mori','mangaka@test.com','MANGAKA','hana'],['Ren Ishikawa','mangaka2@test.com','MANGAKA','ren'],
    ['Minh Anh','assistant@test.com','ASSISTANT','minh'],['Kaito Sato','assistant2@test.com','ASSISTANT','kaito'],['Takuma Narita','editor@test.com','EDITOR','takuma'],
    ['Sasaki Board','board@test.com','BOARD_MEMBER','sasaki'],['Aiko Tanabe','board1@test.com','BOARD_MEMBER','aiko'],['Daichi Kuroda','board2@test.com','BOARD_MEMBER','daichi'],['Mei Watanabe','board3@test.com','BOARD_MEMBER','mei']
  ];
  const records=[];
  const created=[];
  for(const [name,email,role,avatar] of specs){
    let account=await User.findOne({email});
    if(account){
      if(account.role!==role)throw new Error('Demo account '+email+' has role '+account.role+', expected '+role+'.');
    }else{
      account=await User.create({name,email,password:PASSWORD,role,avatar:'https://api.dicebear.com/7.x/avataaars/svg?seed='+avatar,...(role==='ASSISTANT'?{bankName:'Manga Studio Bank',accountNumber:email==='assistant@test.com'?'0123456789':'9876543210',cardholder:name.toUpperCase()}: {})});
      created.push(email);
    }
    records.push(account);
  }
  return {byEmail:Object.fromEntries(records.map(x=>[x.email,x])),created};
}
async function createSeries(users){
  const a=users['mangaka@test.com'],b=users['mangaka2@test.com'],editor=users['editor@test.com'];
  const specs=[
    ['Neon Ronin: Last Signal','Cyberpunk',['Action','Sci-Fi','Samurai'],'PUBLISHED','WEEKLY',a,'A masterless cyborg samurai hunts the signal that erased his clan from Neo Kyoto.'],
    ['Whispers of the Moon Garden','Fantasy',['Romance','Mystery','Iyashikei'],'PUBLISHED','MONTHLY',a,'Every full moon, a forgotten garden reveals one memory its visitors tried to bury.'],
    ['Crimson Harbor','Mystery',['Crime','Drama','Seinen'],'PUBLISHED','WEEKLY',b,'A rookie reporter follows red paper boats through a city ruled by silence.'],
    ['Clockwork Familiar','Fantasy',['Adventure','Magic','Comedy'],'ACTIVE','MONTHLY',b,'An apprentice witch summons a mechanical fox with a map to the end of time.'],
    ['The Ninth Lantern','Supernatural',['Horror','Folklore','Drama'],'IN_PRODUCTION','MONTHLY',a,'Eight lanterns guide the dead home. The ninth invites something else.'],
    ['Skyline Runners','Sports',['Parkour','Youth','Action'],'IN_PRODUCTION','WEEKLY',b,'Four rooftop couriers race across a vertical city.'],
    ['Paper Kingdom','Adventure',['Family','Fantasy','Comedy'],'APPROVED','MONTHLY',a,'A bookbinder falls into a kingdom made from unfinished stories.'],
    ['Echoes Beneath the Rain','Drama',['Music','Romance','Slice of Life'],'PENDING',null,b,'A pianist and sound engineer record voices hidden inside summer rain.']
  ];
  const records=await Series.create(specs.map(([title,genre,tags,status,pubSchedule,mangaka,synopsis],i)=>({title,genre,tags,status,pubSchedule,synopsis,mangakaId:mangaka._id,imageUrl:pic('cover-'+(i+1),600,900),bannerUrl:pic('banner-'+(i+1),1600,600),editorId:status==='PENDING'?null:editor._id,reviewedBy:status==='PENDING'?null:editor._id,reviewNote:status==='PENDING'?'':'Concept and audience fit verified.',reviewedAt:status==='PENDING'?null:plusDays(-40+i)})));
  return Object.fromEntries(records.map(x=>[x.title,x]));
}

async function createProposals(users,seriesMap){
  const editor=users['editor@test.com'];
  const records=await Proposal.create(Object.values(seriesMap).map((s,i)=>({title:s.title,genre:s.genre,synopsis:s.synopsis,storyboardUrl:pic('storyboard-'+(i+1),1200,800),storyboardOriginalName:s.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.jpg',status:s.status==='PENDING'?'SENT_TO_EDITORIAL_BOARD':'SERIES_CREATED',mangakaId:s.mangakaId,seriesId:s.status==='PENDING'?null:s._id,submittedAt:plusDays(-70+i*4),comments:[{authorId:editor._id,authorName:editor.name,authorRole:'editor',content:s.status==='PENDING'?'Board review required.':'Ready for serialization.',isInternal:false,createdAt:plusDays(-60+i*4)}]})));
  for(const p of records){if(p.seriesId)await Series.updateOne({_id:p.seriesId},{proposalId:p._id});}
  return Object.fromEntries(records.map(x=>[x.title,x]));
}

async function createCatalog(users){
  const mangaA=users['mangaka@test.com'],mangaB=users['mangaka2@test.com'],editor=users['editor@test.com'];
  const specs=[
    ['One Piece – Vua Hải Tặc','One Piece','Vua Hải Tặc','Eiichiro Oda',1997,'Adventure',['Pirates','Fantasy','Action'],'Monkey D. Luffy sails across a vast ocean to find the legendary treasure One Piece and become Pirate King.'],
    ['Dragon Ball – Bảy Viên Ngọc Rồng','Dragon Ball','Bảy Viên Ngọc Rồng','Akira Toriyama',1984,'Action',['Martial Arts','Adventure','Comedy'],'Son Goku trains, explores the world and protects Earth while searching for the seven Dragon Balls.'],
    ['Naruto','Naruto','Naruto','Masashi Kishimoto',1999,'Action',['Ninja','Adventure','Coming of Age'],'A young ninja rejected by his village strives to earn recognition and become Hokage.'],
    ['Kochikame – Cảnh Sát Kỳ Tài','Kochikame','Cảnh Sát Kỳ Tài','Osamu Akimoto',1976,'Comedy',['Police','Slice of Life','Workplace'],'Officer Kankichi Ryotsu turns daily police-box life into an endless chain of ambitious and comic incidents.'],
    ['Thám Tử Lừng Danh Conan','Detective Conan','Thám Tử Lừng Danh Conan','Gosho Aoyama',1994,'Mystery',['Detective','Crime','Suspense'],'A brilliant teenage detective trapped in a child body secretly solves difficult criminal cases.'],
    ['Slam Dunk – Cao Thủ Bóng Rổ','Slam Dunk','Cao Thủ Bóng Rổ','Takehiko Inoue',1990,'Sports',['Basketball','School','Comedy'],'Hanamichi Sakuragi joins Shohoku basketball and discovers discipline, rivalry and love for the game.'],
    ['Tetsuwan Atomu – Siêu Nhí Astro','Tetsuwan Atomu','Siêu Nhí Astro','Osamu Tezuka',1952,'Science Fiction',['Robot','Adventure','Classic'],'A powerful childlike robot protects humans and machines while searching for a place to belong.'],
    ['Doraemon – Đôrêmon','Doraemon','Đôrêmon','Fujiko F. Fujio',1969,'Comedy',['Family','Time Travel','School'],'A robotic cat from the future helps Nobita face everyday problems with extraordinary gadgets.'],
    ['Hokuto no Ken – Bắc Đẩu Thần Quyền','Hokuto no Ken','Bắc Đẩu Thần Quyền','Buronson and Tetsuo Hara',1983,'Action',['Martial Arts','Post Apocalyptic','Drama'],'Kenshiro crosses a ruined world using Hokuto Shinken to defend the weak from brutal warlords.'],
    ['Touch – Chạm Tới','Touch','Chạm Tới','Mitsuru Adachi',1981,'Sports',['Baseball','Romance','School'],'Twin brothers and their childhood friend grow through baseball, rivalry, grief and first love.'],
    ['Hajime no Ippo – Võ Sĩ Quyền Anh Ippo','Hajime no Ippo','Võ Sĩ Quyền Anh Ippo','George Morikawa',1989,'Sports',['Boxing','Coming of Age','Comedy'],'Bullied student Ippo Makunouchi enters professional boxing and learns what it means to be strong.'],
    ["JoJo's Bizarre Adventure – Cuộc Phiêu Lưu Bí Ẩn","JoJo's Bizarre Adventure",'Cuộc Phiêu Lưu Bí Ẩn','Hirohiko Araki',1986,'Adventure',['Supernatural','Action','Generational Saga'],'Generations of the Joestar family confront supernatural enemies through strange powers and bold adventures.']
  ];
  const records=await Series.create(specs.map(([title,originalTitle,localizedTitle,originalAuthor,publicationYear,genre,tags,synopsis],i)=>({
    title,originalTitle,localizedTitle,originalAuthor,publicationYear,genre,tags,synopsis,
    status:'PUBLISHED',pubSchedule:i===6||i===7||i===11?'MONTHLY':'WEEKLY',
    mangakaId:i%2?mangaB._id:mangaA._id,editorId:editor._id,reviewedBy:editor._id,
    reviewNote:'Featured catalogue reference data for the Manga Studio demonstration.',reviewedAt:plusDays(-90+i),
    imageUrl:originalTitle==='One Piece'?'/manga/one-piece/cover.jpg':'https://placehold.co/600x900/171717/E63946?text='+encodeURIComponent(originalTitle),
    bannerUrl:'https://placehold.co/1600x600/F6F0E4/171717?text='+encodeURIComponent(originalTitle),
    isCatalogFeatured:true
  })));
  const chapters=[],pages=[];
  for(const [si,series] of records.entries()){
    for(let ci=0;ci<3;ci+=1){
      const hasImportedPages=series.originalTitle==='One Piece'&&ci===0;
      const pageCount=hasImportedPages?53:4;
      const chapterTitle=hasImportedPages?'Romance Dawn':['Opening Chapter','A New Challenge','Turning Point'][ci];
      const chapter=await Chapter.create({seriesId:series._id,chapterNumber:ci+1,title:chapterTitle,status:'PUBLISHED',dueAt:plusDays(-80+ci*20),publishedAt:plusDays(-80+ci*20),createdBy:series.mangakaId,totalPages:pageCount});
      chapters.push(chapter);
      const chapterPages=await Page.create(Array.from({length:pageCount},(_,pi)=>({
        chapterId:chapter._id,pageNumber:pi+1,status:'APPROVED',approvedAt:plusDays(-75+ci*20),
        imageUrl:hasImportedPages?'/manga/one-piece/chapter-1/page-'+String(pi+1).padStart(3,'0')+'.jpg':'https://placehold.co/800x1200/F6F0E4/171717?text='+encodeURIComponent(series.originalTitle+' CH '+(ci+1)+' PAGE '+(pi+1)),
        assistantImageUrl:'',note:hasImportedPages?'Imported from the user-provided One Piece chapter folder.':'Original copyright-safe placeholder page for catalogue demonstration.',reviewNote:'Catalogue page approved.'
      })));
      pages.push(...chapterPages);
    }
  }
  return {series:Object.fromEntries(records.map(x=>[x.title,x])),chapters,pages};
}
async function createProduction(users,seriesMap){
  const result={chapters:[],pages:[],tasks:[]};
  const plans={PUBLISHED:['PUBLISHED','PUBLISHED','PUBLISHED','SENT_TO_EDITORIAL'],ACTIVE:['PUBLISHED','APPROVED','IN_PROGRESS'],IN_PRODUCTION:['APPROVED','UNDER_REVIEW','IN_PROGRESS'],APPROVED:['IN_PROGRESS','IN_PROGRESS'],PENDING:[]};
  for(const [si,s] of Object.values(seriesMap).entries()){
    for(const [ci,status] of (plans[s.status]||[]).entries()){
      const published=status==='PUBLISHED';
      const chapter=await Chapter.create({seriesId:s._id,chapterNumber:ci+1,title:['The Door Opens','A Name in Static','Crossing at Midnight','The Choice Ahead'][ci],status,dueAt:published?plusDays(-35+ci*8):plusDays(5+ci*7),publishedAt:published?plusDays(-40+ci*8):null,createdBy:s.mangakaId,totalPages:6});
      result.chapters.push(chapter);
      const ps=published||['APPROVED','SENT_TO_EDITORIAL'].includes(status)?'APPROVED':status==='UNDER_REVIEW'?'COMPLETED':'IN_PROGRESS';
      const pages=await Page.create(Array.from({length:6},(_,pi)=>({chapterId:chapter._id,pageNumber:pi+1,imageUrl:pic((si+1)+'-'+(ci+1)+'-'+(pi+1)),assistantImageUrl:ps==='IN_PROGRESS'?'':pic('ink-'+(si+1)+'-'+(ci+1)+'-'+(pi+1)),status:ps,note:'Storyboard page '+(pi+1)+': panel and dialogue reference.',reviewNote:ps==='APPROVED'?'Line work and tones approved.':'',approvedAt:ps==='APPROVED'?plusDays(-5):null})));
      result.pages.push(...pages);
      const ts=published||status==='APPROVED'?'APPROVED':status==='UNDER_REVIEW'?'SUBMITTED':ci%2?'PENDING':'IN_PROGRESS';
      const assistant=(si+ci)%2?users['assistant@test.com']:users['assistant2@test.com'];
      const task=await Task.create({seriesId:s._id,chapterId:chapter._id,assignedTo:assistant._id,assignedBy:s.mangakaId,title:'Ink and tone Ch.'+chapter.chapterNumber+' - '+s.title,description:'Complete line art, screentone and backgrounds.',pageIds:pages.map(x=>x._id),status:ts,submittedAt:['SUBMITTED','APPROVED'].includes(ts)?plusDays(-4):null,reviewedAt:ts==='APPROVED'?plusDays(-2):null,reviewNote:ts==='APPROVED'?'Approved for assembly.':'',dueAt:published?plusDays(-10):plusDays(3+ci*5),regions:[{x:40,y:80,width:420,height:560,type:'TASK_ZONE',comment:'Primary inking area'}]});
      result.tasks.push(task);
      if(['UNDER_REVIEW','APPROVED'].includes(status))await Annotation.create({pageId:pages[1]._id,annotatorId:users['editor@test.com']._id,coords:{x:28,y:32,width:36,height:20},content:'Increase contrast and leave room for dialogue.',type:'SCENE_IMPROVEMENT'});
    }
  }
  return result;
}

async function createMetrics(users,seriesMap){
  const ranked=Object.values(seriesMap).filter(x=>['PUBLISHED','ACTIVE','IN_PRODUCTION'].includes(x.status));
  const start=plusDays(-7),end=plusDays(0),oldStart=plusDays(-14),oldEnd=plusDays(-7);
  await Rating.create(ranked.flatMap((s,i)=>{
    const votes=260000-i*11000,score=Math.max(3.8,4.9-i*.05),previousRank=i%3===0?i+2:i%3===1?Math.max(1,i):i+1;
    return [
      {seriesId:s._id,voteCount:votes,cycle:'WEEKLY',periodStart:start,periodEnd:end,ratingScore:score,readerCount:votes*4,revenue:votes*1200,sourceFrom:'DEMO_CATALOGUE',submittedBy:users['board@test.com']._id},
      {seriesId:s._id,voteCount:Math.round(votes*.86),cycle:'WEEKLY',periodStart:oldStart,periodEnd:oldEnd,ratingScore:Math.max(3.7,score-.12),readerCount:votes*3,revenue:votes*1000,sourceFrom:'DEMO_CATALOGUE',submittedBy:users['board@test.com']._id}
    ];
  }));
  await Ranking.create(ranked.flatMap((s,i)=>{
    const votes=260000-i*11000,previousRank=i%3===0?i+2:i%3===1?Math.max(1,i):i+1,currentRank=i+1;
    return [
      {seriesId:s._id,rank:currentRank,prevRank:previousRank,votes,ratingScore:Math.max(3.8,4.9-i*.05),trend:previousRank>currentRank?'up':previousRank<currentRank?'down':'flat',cycle:'weekly',cycleStart:start,cycleEnd:end},
      {seriesId:s._id,rank:previousRank,prevRank:previousRank,votes:Math.round(votes*.86),ratingScore:Math.max(3.7,4.78-i*.05),trend:'flat',cycle:'weekly',cycleStart:oldStart,cycleEnd:oldEnd}
    ];
  }));
  await SeriesRank.create(ranked.map((s,i)=>({seriesId:s._id,rank:i+1,prevRank:i%3===0?i+2:i%3===1?Math.max(1,i):i+1,rankedOn:end})));
}
async function createBoard(users,seriesMap,proposalMap,production){
  const members=['board@test.com','board1@test.com','board2@test.com','board3@test.com'].map(x=>users[x]);
  const editor=users['editor@test.com'];
  const pitch=await Submission.create({proposalId:proposalMap['Echoes Beneath the Rain']._id,submissionType:'PITCH',submittedBy:editor._id,action:'APPROVE_MONTHLY',decisionStatus:'PENDING',chairpersonId:members[0]._id,requiredVoters:members.map((x,i)=>({userId:x._id,hasVoted:i<2})),reason:'New monthly drama review.'});
  const pv=await Vote.create([{submissionId:pitch._id,voterId:members[0]._id,decision:'ACCEPT',comment:'Distinct concept.'},{submissionId:pitch._id,voterId:members[1]._id,decision:'REJECT',comment:'Opening needs a stronger hook.'}]);
  pitch.requiredVoters[0].voteId=pv[0]._id;pitch.requiredVoters[1].voteId=pv[1]._id;await pitch.save();
  const chapter=production.chapters.find(x=>x.status==='SENT_TO_EDITORIAL');
  const series=Object.values(seriesMap).find(x=>String(x._id)===String(chapter.seriesId));
  const pub=await Submission.create({seriesId:series._id,chapterId:chapter._id,submissionType:'PUBLICATION_REVIEW',submittedBy:editor._id,action:'PUBLISH',decisionStatus:'PENDING',chairpersonId:members[0]._id,requiredVoters:members.map((x,i)=>({userId:x._id,hasVoted:i<3})),reason:'Final publication review.'});
  const votes=await Vote.create([{submissionId:pub._id,voterId:members[0]._id,decision:'PUBLISH',comment:'Ready.'},{submissionId:pub._id,voterId:members[1]._id,decision:'PUBLISH',comment:'Quality approved.'},{submissionId:pub._id,voterId:members[2]._id,decision:'RESCHEDULE',comment:'Add marketing buffer.'}]);
  votes.forEach((v,i)=>{pub.requiredVoters[i].voteId=v._id;});await pub.save();
}

async function createExtras(users,production){
  for(const assistant of [users['assistant@test.com'],users['assistant2@test.com']]){
    const tasks=production.tasks.filter(x=>String(x.assignedTo)===String(assistant._id)&&x.status==='APPROVED');
    const approved=tasks.flatMap(t=>t.pageIds.slice(0,4).map(pageId=>({pageId,taskId:t._id,chapterId:t.chapterId,seriesId:t.seriesId,approvedAt:plusDays(-2)})));
    await Earning.create({assistantId:assistant._id,month:new Date().toISOString().slice(0,7),totalPagesApproved:approved.length,ratePerPage:50000,totalEarning:approved.length*50000,approvedPages:approved,paymentStatus:assistant.email==='assistant2@test.com'?'PAID':'PENDING',paidAt:assistant.email==='assistant2@test.com'?plusDays(-1):null});
  }
  const ns=[['mangaka@test.com','Chapter approved','Artwork passed final review.','INFO'],['mangaka@test.com','Board vote in progress','Publication review is waiting.','WARNING'],['assistant@test.com','New task assigned','Line art work was assigned.','INFO'],['assistant@test.com','Payment summary ready','Approved earnings are ready.','INFO'],['editor@test.com','Manuscript submitted','A chapter is ready.','INFO'],['board@test.com','Vote required','A pitch requires your decision.','WARNING']];
  await Notification.create(ns.map(([email,title,content,type],i)=>({userId:users[email]._id,title,content,type,isRead:i%3===0})));
  await AuditLog.create({userId:users['admin@test.com']._id,userName:'Studio Admin',action:'Seeded demo catalogue',target:'Manga Studio OS',details:'Created linked demo workflow data.'});
}

async function main(){
  if(!process.env.MONGODB_URI)throw new Error('MONGODB_URI is missing from .env');
  const isRemote = !/mongodb:\/\/(localhost|127\.0\.0\.1)/i.test(process.env.MONGODB_URI);
  if(isRemote && !process.argv.includes('--confirm-remote')) {
    throw new Error('Remote MongoDB detected. Re-run with --confirm-remote after reviewing cleanup scope.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');
  console.log('Removed demo data:',await cleanDemo());
  if(process.argv.includes('--clean-only')){console.log('Demo cleanup complete. Team data was preserved.');return;}
  const userResult=await createUsers(),users=userResult.byEmail,catalog=await createCatalog(users);
  await createMetrics(users,catalog.series);
  console.log('Catalogue seed complete:',{users:Object.keys(users).length,catalogSeries:Object.keys(catalog.series).length,catalogChapters:catalog.chapters.length,catalogPages:catalog.pages.length});
  if(userResult.created.length){console.log('Created missing accounts:',userResult.created);console.log('Password for newly created accounts: '+PASSWORD);}else{console.log('All demo accounts were preserved; existing passwords were not changed.');}
}
main().catch(error=>{console.error('Seed failed:',error);process.exitCode=1;}).finally(async()=>mongoose.disconnect());
