const origin = 'https://dhc.lu.lv';

/** Keep legacy reader URLs usable while consolidating search and citation URLs. */
export function canonicalUrl(pathname) {
  const path = pathname.replace(/^\/teikas\/teikas(?=\/|$)/, '/teikas/teksti');
  return new URL(path.endsWith('/') ? path : `${path}/`, origin).href;
}

export function pageMetadata(pathname) {
  const section = pathname.replace(/^\/teikas\/?/, '').split('/')[0];
  const descriptions = {
    teksti: 'Meklē latviešu tautas teikas Pētera Šmita krājumā pēc teksta, tēmas, vietas, teicēja un pierakstītāja. Oriģinālteksti, vācu tulkojumi un avotu ziņas.',
    teikas: 'Meklē latviešu tautas teikas Pētera Šmita krājumā pēc teksta, tēmas, vietas, teicēja un pierakstītāja. Oriģinālteksti, vācu tulkojumi un avotu ziņas.',
    temas: 'Latviešu tautas teiku tēmu katalogs: Pētera Šmita krājuma 13.–15. sējuma nodaļas un apakšnodaļas. Atrodi teikas un izpēti to vietas un saiknes.',
    personas: 'Latviešu teiku teicēji un pierakstītāji Pētera Šmita krājumā. Izpēti personām piesaistītos tekstus, tēmas, vietas un saiknes.',
    karte: 'Latviešu tautas teikas kartē: izpēti Pētera Šmita krājuma teiku vietas, tekstus un saiknes ar teicējiem un pierakstītājiem.',
  };
  return {
    title: 'Teikas',
    description: descriptions[section] || 'Latviešu tautas teikas Pētera Šmita krājuma 13.–15. sējumā. LU Digitālo humanitāro zinātņu centra platforma ar avotu ziņām, vācu tulkojumiem, karti un pētniecības rīkiem.',
  };
}
