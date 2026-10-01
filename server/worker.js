import {progressAPI} from './progress.js';
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/progress')return progressAPI(request,env.DB);
    if(env.ASSETS)return env.ASSETS.fetch(request);
    return new Response('De game kon niet geladen worden.',{status:503});
  }
};
