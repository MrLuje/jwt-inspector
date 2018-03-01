import url from 'url';
import { isJwt } from '../utils';
import RequestListener from './RequestListener';

export default class RequestJwtDiscoverer {
  constructor(store) {
    this.store = store;
    this.requestListener = new RequestListener();
  }

  start() {
    this.requestListener.on('request', (request) => {
      let jwts = [];

      let parsedUrl = url.parse(request.url, true);

      if (parsedUrl.query) {
        for (let key in parsedUrl.query) {
          let value = parsedUrl.query[key];
          if (isJwt(value)) {
            jwts.push({
              type: 'query_string',
              name: key,
              value: value,
              rawValue: value
            });
          }
        }
      }

      let processToken = (type, headerName, headerValue, lValue) => {
        if (isJwt(lValue)) {
          jwts.push({
            type: type,
            name: headerName,
            value: lValue,
            rawValue: headerValue
          });
        };
      };

      request.request.headers.forEach((header) => {
        let value = header.value;

        switch (header.name.toLowerCase()) {
          case 'authorization':
            let [type, innerValue] = value.split(' ', 2);
            switch (type.toLowerCase()) {
              case 'bearer':
              value = innerValue;
              break;
            }
            break;
          case 'x-client':
            let xClient = JSON.parse(value);
            processToken('request_header', "XClient-Context", header.value, xClient.Context);
            processToken('request_header', "XClient-Auth", header.value, xClient.Auth);
            return;
        }

        processToken(header, value);
      });

      request.response.headers.forEach((header) => {
        let value = header.value;
        let jwtVerified = false;

        switch (header.name.toLowerCase()) {
          case 'location':
            let parsedUrl = url.parse(value, true);

            if (parsedUrl) {
              if (parsedUrl.query) {
                for (let key in parsedUrl.query) {
                  let queryValue = parsedUrl.query[key];
                  if (isJwt(queryValue)) {
                    jwtVerified = true;
                    jwt = queryValue;
                    break;
                  }
                }
              }

              if (parsedUrl.hash && parsedUrl.hash.indexOf('#/?') === 0) {
                let parsedHashUrl = url.parse(parsedUrl.hash.substring(3));
                if (parsedHashUrl) {
                  if (parsedHashUrl.query) {
                    for (let key in parsedHashUrl.query) {
                      let queryValue = parsedHashUrl.query[key];
                      if (isJwt(queryValue)) {
                        jwtVerified = true;
                        value = queryValue;
                        break;
                      }
                    }
                  }
                }
              }
            }
            break;
            
            case 'x-client':
              let xClient = JSON.parse(value);
              processToken('response_header', "XClient-Context", header.value, xClient.Context);
              processToken('response_header', "XClient-Auth", header.value, xClient.Auth);
            break;
        }

        if (jwtVerified || isJwt(header.value)) {
          jwts.push({
            type: 'response_header',
            name: header.name,
            value: value,
            rawValue: header.value
          });
        }
      });

      if (jwts.length > 0) {
        this.store.set({
          id: request.requestId,
          jwts: jwts,
          ...request
        });
      }
    });

    this.requestListener.start();
  }

  stop() {
  }
}
