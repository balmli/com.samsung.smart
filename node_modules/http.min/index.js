const URL = require('url').URL
const http = require('http')
const https = require('https')
const querystring = require('querystring')

const HTTP = {};

(['HEAD', 'OPTIONS', 'GET', 'PUT', 'PATCH', 'POST', 'DELETE']).forEach(function (method) {
  // https://nodejs.org/api/http.html#http_http_request_options_callback
  HTTP[method.toLowerCase()] = function (options, data) {
    return new Promise(function (resolve, reject) {
      if (typeof options === 'string') {
        options = parseURL(options)
      } else {
        const query = options.query
        if (options.form) {
          data = querystring.stringify(options.form)
        }
        if (typeof options.json === 'object') {
          data = options.json
        }
        if (options.uri) {
          merge(options, parseURL(options.uri))
        }
        if (query) {
          if (Object.keys(query).length !== 0) {
            options.path += '?' + querystring.stringify(query)
          }
          delete options.query
        }
      }
      if (data) {
        const isObject = typeof data === 'object'
        const headers = options.headers || (options.headers = {})
        if (!headers['content-type']) {
          headers['content-type'] = isObject ? 'application/json' : 'application/x-www-form-urlencoded'
        }
        if (options.json && !headers['accept']) {
          headers['accept'] = 'application/json'
        }
        if (isObject) {
          data = JSON.stringify(data)
        }
        headers['content-length'] = Buffer.byteLength(data)
      }
      options.method = method
      const module = options.protocol.indexOf('https') === 0 ? https : http
      const req = module.request(options, function (response) {
        const data = []
        response.setEncoding('utf8')
        response.on('data', function (chunk) {
          data.push(chunk)
        })
        response.on('end', function () {
          var result = {
            data: data.join(''),
            response: response
          }
          if (options.json) {
            result = parseJSON(result)
          }
          resolve(result)
        })
      }).on('error', reject)
      if (options.timeout) {
        req.setTimeout(options.timeout)
      }
      req.on('timeout', function () {
        req.destroy()
        reject(new Error('timeout'))
      })
      if (data) {
        req.write(data)
      }
      if (options.request) {
        options.request(req)
      }
      req.end()
    })
  }
})

HTTP.json = function (options) {
  return this.get(options)
    .then(parseJSON)
    .then(function (result) {
      return result.data
    })
}

function merge (dest, src) {
  for (const k in src) {
    dest[k] = src[k]
  }
  return dest
}

function parseURL (url) {
  const options = merge({}, new URL(url))
  options.path = options.pathname + options.search
  return options
}

function parseJSON (result) {
  try {
    result.data = JSON.parse(result.data)
    return result
  } catch (e) {
    return Promise.reject(e)
  }
}

// make http.get() default exported function
module.exports = merge(HTTP.get, HTTP)
