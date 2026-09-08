import { createLocalRunArchivePlugin } from '../server/localRunArchive.ts';
export default {base:'./',assetsInclude:['**/*.xml'],plugins:[createLocalRunArchivePlugin()]};
