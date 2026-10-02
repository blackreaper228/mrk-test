const LIMIT = 200;
const DEFAULT_ROOT_FOLDER_ID = "1chVqAXwmi-lDIRuQuwTebpDIRXT-O_aQ";
function setup() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  let root;
  if (props.getProperty('ROOT_FOLDER_ID')) root = DriveApp.getFolderById(props.getProperty('ROOT_FOLDER_ID'));
  else { root = DriveApp.getFolderById(DEFAULT_ROOT_FOLDER_ID); props.setProperty('ROOT_FOLDER_ID', root.getId()); }
  props.setProperty('SPREADSHEET_ID', sheet.getId());
  DriveApp.getFileById(sheet.getId()).moveTo(root);
  const schemas = {
    Pages: ['slug','title','folder','published','spaceAbove'],
    Works: ['id','page','title','folder','video','coverUrl','description','published'],
    Home: ['title','workId','imageUrl','published']
  };
  for (const [name,headers] of Object.entries(schemas)) {
    const tab = sheet.getSheetByName(name) || sheet.insertSheet(name);
    if (!tab.getLastRow()) { tab.appendRow(headers); tab.setFrozenRows(1); tab.getRange(1,1,1,headers.length).setFontWeight('bold'); }
  }
  const pages = sheet.getSheetByName('Pages');
  if (pages.getLastRow() === 1) {
    const events = root.createFolder('Events');
    events.createFolder('Test photoshoot');
    pages.appendRow(['events','Events',events.getUrl(),true,false]);
  }
  Logger.log('Root folder: ' + root.getUrl());
  Logger.log('Spreadsheet: ' + sheet.getUrl());
}
function rows(name) {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')).getSheetByName(name);
  if (!sheet || sheet.getLastRow()<2) return [];
  const values = sheet.getDataRange().getValues(),headers=values.shift();
  return values.filter(row=>row.some(value=>value!=='' )).map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));
}
function enabled(value){return value === true || ['true','yes','1'].includes(String(value).toLowerCase());}
function folderId(value){const match=String(value).match(/folders\/([\w-]+)/);if(match)return match[1];if(/^[\w-]{10,}$/.test(String(value)))return String(value);throw new Error('Invalid folder URL');}
function insideRoot(folder) {
  const root=PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  const queue=[folder],seen=new Set();
  while(queue.length){const current=queue.shift(),id=current.getId();if(id===root)return true;if(seen.has(id))continue;seen.add(id);const parents=current.getParents();while(parents.hasNext())queue.push(parents.next());}
  return false;
}
function album(value) {
  const folder=DriveApp.getFolderById(folderId(value));
  if(!insideRoot(folder))throw new Error('All gallery folders must be inside MRK Test');
  return folder;
}
function images(folder) {
  if(!folder)return [];
  const result=[],files=folder.getFiles();
  while(files.hasNext()){
    const file=files.next();if(!/^image\//.test(file.getMimeType()))continue;
    result.push({id:file.getId(),name:file.getName()});
    if(result.length>LIMIT)throw new Error('A photoshoot supports up to '+LIMIT+' photos');
  }
  return result.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
}
function website() {
  const result={pages:[],works:[],home:[]},seenPages=new Set(),seenWorks=new Set();
  const pageRows=rows('Pages').filter(row=>enabled(row.published));
  for(const row of pageRows){
    const slug=String(row.slug).trim();if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||seenPages.has(slug))throw new Error('Invalid or duplicate page slug');
    seenPages.add(slug);result.pages.push({slug,title:String(row.title||slug),spaceAbove:enabled(row.spaceAbove)});
  }
  const addWork=(row,folder)=>{
    const id=String(row.id);if(seenWorks.has(id))throw new Error('Duplicate photoshoot ID');seenWorks.add(id);
    const photos=images(folder);result.works.push({id,page:row.page,title:String(row.title||folder?.getName()||id),description:String(row.description||''),images:photos,cover:row.coverUrl?{url:String(row.coverUrl)}:photos[0]||null,video:String(row.video||'')});
  };
  const explicit=rows('Works').filter(row=>enabled(row.published)&&seenPages.has(String(row.page)));
  const explicitFolders=new Set();
  for(const row of explicit){const folder=row.folder?album(row.folder):null;if(folder)explicitFolders.add(folder.getId());addWork(row,folder);}
  for(const row of pageRows){
    if(!row.folder)continue;const folder=album(row.folder),children=folder.getFolders();
    while(children.hasNext()){
      const child=children.next();if(explicitFolders.has(child.getId()))continue;
      addWork({id:String(row.slug)+'-'+child.getId(),page:String(row.slug),title:child.getName()},child);
    }
    const direct=images(folder);if(direct.length&&!explicitFolders.has(folder.getId()))addWork({id:String(row.slug)+'-'+folder.getId(),page:String(row.slug),title:String(row.title)},folder);
  }
  for(const row of rows('Home').filter(row=>enabled(row.published))){
    const work=result.works.find(work=>work.id===String(row.workId));if(!work)continue;
    result.home.push({id:work.id,title:String(row.title||work.title),cover:row.imageUrl?{url:String(row.imageUrl)}:work.cover});
  }
  return result;
}
function doGet(e) {
  const callback=String(e?.parameter?.callback||'');
  if(callback&&!/^mrkCallback\d+$/.test(callback))return ContentService.createTextOutput('Invalid callback');
  let value;
  try {
    const data=website();
    if(e?.parameter?.action==='image'){
      const id=String(e.parameter.id||'');
      if(!data.works.some(work=>work.images.some(image=>image.id===id)))throw new Error('Image is not part of a published gallery');
      const file=DriveApp.getFileById(id);
      // Large originals use Drive's small preview in this basic test; originals stay untouched.
      const blob=file.getSize()>6*1024*1024?file.getThumbnail():file.getBlob();
      if(!blob)throw new Error('No preview available');
      value={mime:blob.getContentType(),base64:Utilities.base64Encode(blob.getBytes())};
    }else value=data;
  }catch(error){console.error(error);value={error:'Unable to load Google content. Check folder access, publication flags and IDs in the spreadsheet.'};}
  const json=JSON.stringify(value);
  return ContentService.createTextOutput(callback?callback+'('+json+');':json).setMimeType(callback?ContentService.MimeType.JAVASCRIPT:ContentService.MimeType.JSON);
}
