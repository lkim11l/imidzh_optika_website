import test from 'node:test';
import assert from 'node:assert/strict';
import {aboutHTML,aboutFields,aboutImages,editorialDefaults} from '../dist/assets/data/editorial.js';
test('about page ignores previously saved owner text and photo URLs',()=>{
 const html=aboutHTML({aboutTitle:'PRIVATE_TITLE',aboutStory:'PRIVATE_STORY',eduardName:'PRIVATE_OWNER',eduardBio:'PRIVATE_BIO',eduardPhoto:'https://example.invalid/private-owner.jpg',nataliaPhoto:'https://example.invalid/private-owner-2.jpg'});
 assert.doesNotMatch(html,/PRIVATE_|private-owner|owner-card/);
 assert.match(html,/Как нас найти/);
 assert.deepEqual(aboutFields,[]);assert.deepEqual(aboutImages,[]);
 assert.ok(!Object.keys(editorialDefaults).some(key=>/^(eduard|natalia)/.test(key)));
});
