// Editorial entry points into the original chapter hierarchy; source records stay unchanged.
export const homeTopics = [
  {id:'dievs-un-velns', chapters:['1301','1302','1401'], icon:'SunMoon', lv:'Dievs un velns', de:'Gott und Teufel', en:'God and the Devil'},
  {id:'raganas-un-burvji', chapters:['1503','1504'], icon:'Moon', lv:'Raganas un burvji', de:'Hexen und Zauberer', en:'Witches and Sorcerers'},
  {id:'veli-un-eni', chapters:['1402','1403'], icon:'Flame', lv:'Veļi un ēni', de:'Totengeister und Schatten', en:'Spirits of the Dead and Shadows'},
  {id:'vilkaci-vadataji-lietuveni', chapters:['1502','1404','1405'], icon:'Trees', lv:'Vilkači, vadātāji un lietuvēni', de:'Werwölfe, Irrgeister und Nachtmahre', en:'Werewolves, Misleading Spirits and Nightmares'},
  {id:'puki-un-vilces', chapters:['1321','1311'], icon:'LineSquiggle', lv:'Pūķi un vilces', de:'Drachen und Vilces', en:'Dragons and Vilces'},
  {id:'majas-gari', chapters:['1310','1312','1313'], icon:'House', lv:'Mājas gari', de:'Hausgeister', en:'Household Spirits'},
  {id:'apslepta-manta', chapters:['1406','1501'], icon:'Shovel', lv:'Apslēptā manta', de:'Verborgene Schätze', en:'Hidden Treasure'},
  {id:'udeni-kalni-akmeni', chapters:['1508'], icon:'Waves', lv:'Ūdeņi, kalni un akmeņi', de:'Gewässer, Berge und Steine', en:'Waters, Hills and Stones'},
];
export function getHomeTopic(id: string | null) {
  return homeTopics.find(topic => topic.id === id) ?? null;
}
export function matchesHomeTopic(record: {id: string}, topic: ReturnType<typeof getHomeTopic>) {
  return !topic || topic.chapters.includes(record.id.slice(0, 4));
}
export function homeTopicName(topic: (typeof homeTopics)[number], lang: string | undefined) {
  return lang === 'de' ? topic.de : lang === 'en' ? topic.en : topic.lv;
}
