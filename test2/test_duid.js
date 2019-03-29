'use strict';

function getDuid(val) {
    return val && val.DUID ?
        (val.DUID.indexOf(':') >= 0 && val.DUID.split(':').length > 1 ? val.DUID.split(':')[1] : val.DUID) :
        undefined;
}

console.log('07270e01-0078-1000-8cd0-5056bf7d0220', getDuid({DUID: '07270e01-0078-1000-8cd0-5056bf7d0220'}));
console.log('uuid:348a7102-c2a4-4dff-8bea-6f062d892043', getDuid({DUID: 'uuid:348a7102-c2a4-4dff-8bea-6f062d892043'}));
console.log('undefined 1', getDuid({DUID: undefined}));
console.log('undefined 2', getDuid());
console.log('undefined 3', getDuid(undefined));
