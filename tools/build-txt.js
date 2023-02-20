const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

const PATH = '../dist';
const FILENAME = 'build.txt';

const buildTxt = () => {
    const dir = path.resolve(__dirname, PATH);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    const content = `version=${version}`;
    fs.writeFileSync(path.resolve(__dirname, PATH, FILENAME), content);
};

buildTxt();
