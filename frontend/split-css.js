const fs = require('fs');
const css = require('css');

const inputCSS = fs.readFileSync('src/styles/components-05.css', 'utf8');
const obj = css.parse(inputCSS);

const files = {
  'create-group.css': [],
  'home.css': [],
  'account.css': [],
  'explore.css': [],
  'other.css': []
};

for (const rule of obj.stylesheet.rules) {
  let matched = false;
  
  if (rule.type === 'rule' || rule.type === 'media') {
    let cssText = css.stringify({ type: 'stylesheet', stylesheet: { rules: [rule] } });
    
    if (cssText.includes('.sv-cg-') || cssText.includes('.sv-create-')) {
      files['create-group.css'].push(rule);
      matched = true;
    } else if (cssText.includes('.sv-home-')) {
      files['home.css'].push(rule);
      matched = true;
    } else if (cssText.includes('.sv-account-')) {
      files['account.css'].push(rule);
      matched = true;
    } else if (cssText.includes('.sv-explore-')) {
      files['explore.css'].push(rule);
      matched = true;
    }
  } else if (rule.type === 'comment') {
    // just put comments in other for now, or copy everywhere
  }
  
  if (!matched) {
    files['other.css'].push(rule);
  }
}

for (const [filename, rules] of Object.entries(files)) {
  if (rules.length > 0) {
    const output = css.stringify({ type: 'stylesheet', stylesheet: { rules } });
    fs.writeFileSync(`src/styles/${filename}`, output);
  }
}

console.log('Successfully split CSS!');
