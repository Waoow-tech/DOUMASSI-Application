// Tests de la convention media_urls des posts — E14-01.
//
// Cette convention ([poster, vidéo] quand media_type === 'video') est implicite
// par nature : rien dans le schéma ne l'impose. C'est exactement le genre de
// règle qui se casse en silence lors d'un refactor — d'où ces tests.

import {
  buildVideoMediaUrls,
  getPostImageCount,
  getPostPosterUrl,
  getPostVideoUrl,
  type PostMediaLike,
} from '../postMedia';

const POSTER = 'https://cdn.test/poster.jpg';
const VIDEO = 'https://cdn.test/clip.mp4';

const videoPost: PostMediaLike = {
  media_type: 'video',
  media_urls: [POSTER, VIDEO],
};

const imagePost: PostMediaLike = {
  media_type: 'image',
  media_urls: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
};

const textPost: PostMediaLike = { media_type: 'text', media_urls: [] };

describe('buildVideoMediaUrls', () => {
  it('range le poster en premier et la vidéo en second', () => {
    expect(buildVideoMediaUrls(POSTER, VIDEO)).toEqual([POSTER, VIDEO]);
  });
});

describe('getPostPosterUrl', () => {
  it('renvoie le poster pour une vidéo (et non le fichier vidéo)', () => {
    expect(getPostPosterUrl(videoPost)).toBe(POSTER);
  });

  it('renvoie la première image pour un post image', () => {
    expect(getPostPosterUrl(imagePost)).toBe('https://cdn.test/a.jpg');
  });

  it('renvoie undefined pour un post texte', () => {
    expect(getPostPosterUrl(textPost)).toBeUndefined();
  });
});

describe('getPostVideoUrl', () => {
  it('renvoie la vidéo, pas le poster', () => {
    expect(getPostVideoUrl(videoPost)).toBe(VIDEO);
  });

  it('retombe sur l’unique URL quand le poster manque', () => {
    // Cas réel : la génération ou l'upload du poster a échoué, on a publié la
    // vidéo seule. Elle doit rester lisible.
    expect(getPostVideoUrl({ media_type: 'video', media_urls: [VIDEO] })).toBe(VIDEO);
  });

  it('renvoie undefined si le post n’est pas une vidéo', () => {
    expect(getPostVideoUrl(imagePost)).toBeUndefined();
    expect(getPostVideoUrl(textPost)).toBeUndefined();
  });
});

describe('getPostImageCount', () => {
  it('ne compte jamais les 2 URL d’une vidéo comme 2 médias', () => {
    // Sans ça, la carte afficherait une pastille « 1/2 » sur une vidéo.
    expect(getPostImageCount(videoPost)).toBe(0);
  });

  it('compte les images d’un post image', () => {
    expect(getPostImageCount(imagePost)).toBe(2);
  });

  it('renvoie 0 pour un post texte', () => {
    expect(getPostImageCount(textPost)).toBe(0);
  });
});
