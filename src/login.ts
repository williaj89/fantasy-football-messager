import 'dotenv/config';
import { connect } from './whatsapp.js';

connect()
  .then((sock) => {
    console.log('Logged in and connected successfully.');
    sock.end(undefined);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
