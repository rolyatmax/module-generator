#!/usr/bin/env node

var prompt   = require('inquirer').prompt
var readdirp = require('readdirp')
var conf     = require('npmconf')
var xtend    = require('xtend')
var dotty    = require('dotty')
var path     = require('path')
var fs       = require('fs')

var target = process.cwd()

getParams(function(err, params) {
  if (err) throw err

  readdirp({
    root: path.join(__dirname, 'templates')
  }).on('data', function(file) {
    var dest = path.resolve(target, file.path)

    if (path.basename(dest) === 'LICENSE_shared.md') {
      if (!params.shared) return
      dest = path.resolve(dest, '..', 'LICENSE.md')
    }
    if (path.basename(dest) === 'LICENSE_solo.md') {
      if (params.shared) return
      dest = path.resolve(dest, '..', 'LICENSE.md')
    }

    if (fs.existsSync(dest)) {
      return console.log('ignoring: ' + file.path)
    }

    fs.readFile(file.fullPath, 'utf8', function(err, content) {
      if (err) throw err

      content = render(content, params)

      if (file.name.match(/\.json$/g)) {
        content = JSON.stringify(JSON.parse(content), null, 2)
      } else {
        dest = dest.replace(/\_\.(gitignore|npmignore)$/, '.$1')
      }

      fs.writeFile(dest, content)
    })
  })
})

function render(template, params) {
  return template.replace(/\{\{([^}]+)}}/g, function(_, name) {
    return dotty.get(params, name)
  })
}

function getParams(done) {
  conf.load({}, function(err, config) {
    if (err) return done(err)

    var data = {
        tags: JSON.stringify(['ecosystem:stackgl'], null, 2)
      , user: {
          name: config.get('init.author.name')
        , site: config.get('init.author.url')
        , email: config.get('init.author.email')
        , github: config.get('init.author.github')
        , username: config.get('username')
      }
    }

    if (!data.user.username) return bail('npm login')
    if (!data.user.name) return bail('npm config set init.author.name "Your Name"')
    if (!data.user.github) return bail('npm config set init.author.github "your-github-handle"')
    if (!data.user.email) return bail('npm config set init.author.email "me@example.com"')
    data.user.site = data.user.site || 'http://github.com/' + data.user.github

    prompt([
      {
          'name': 'name'
        , 'message': 'Module name'
        , 'default': path.basename(target)
      },
      {
          'name': 'description'
        , 'message': 'Module description'
      },
      {
          'name': 'stability'
        , 'type': 'list'
        , 'message': 'Module stability:'
        , 'default': 'experimental'
        , 'choices': [
            'deprecated'
          , 'experimental'
          , 'unstable'
          , 'stable'
          , 'frozen'
          , 'locked'
        ]
      },
      {
          'name': 'shared'
        , 'message': 'Hosted in the stackgl GitHub organisation?'
        , 'default': false
        , 'type': 'confirm'
      }
    ], function(results) {
      if (err) return done(err)
      if (results.shared) data.user.github = 'stackgl'

      results.name = dequote(results.name)
      results.description = dequote(results.description)

      done(null, xtend(results, data))
    })
  })
}

function bail(cmd) {
  console.log('')
  console.log('Missing configuration option, please run the following using your own value:')
  console.log('')
  console.log('  > ' + cmd)
  console.log('')
}

function dequote(str) {
  return str.replace(/\"+/g, '\\"')
}
