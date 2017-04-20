/**
 * This file is part of the simple-svg-tools package.
 *
 * (c) Vjacheslav Trushkin <cyberalien@gmail.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

"use strict";

const fs = require('fs');
const cheerio = require('cheerio');
const SVGImporter = require('./svg');
const SVG = require('../svg');
const Collection = require('../collection');

const defaults = {
    keywordCallback: key => key.toLowerCase().replace(/_/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '').replace(/--*/, '-'),
    headless: true,
    minify: true,
    debug: false,
    log: console.log
};

function load(source, options) {
    return new Promise((fulfill, reject) => {
        // Check if source is object
        if (source instanceof SVG) {
            fulfill(source);
            return;
        }

        // Source is string?
        if (typeof source === 'string') {
            // Is it svg file
            if (source.trim().slice(0, 1) === '<') {
                let svg = new SVG(source);
                fulfill(svg);
                return;
            }

            // filename
            SVGImporter(source, options).then(svg => {
                fulfill(svg);
            }).catch(err => {
                reject(err);
            });
            return;
        }

        reject('Invalid source');
    });
}

/**
 * Import icons from web icon svg
 */
module.exports = (source, options) => {
    options = options === void 0 ? {} : options;
    Object.keys(defaults).forEach(key => {
        if (options[key] === void 0) {
            options[key] = defaults[key];
        }
    });

    return new Promise((fulfill, reject) => {
        load(source, options).then(svg => {
            let $root = svg.$svg(':root');
            if ($root.length > 1 || $root.get(0).tagName !== 'svg') {
                return reject('Missing SVG element');
            }

            let $defs = $root.children('defs');

            if (!$defs.length) {
                return reject('Missing definitions');
            }

            let collection = new Collection();

            // Check each symbol
            $defs.children('symbol').each((index, symbol) => {
                let $symbol = cheerio(symbol),
                    symbolAttributes = symbol.attribs;

                if (!symbolAttributes.id) {
                    return;
                }
                let id = symbolAttributes.id;

                // Get dimensions
                let width = false,
                    height = false,
                    left = 0,
                    top = 0;

                if (symbolAttributes.width !== void 0) {
                    width = parseFloat(symbolAttributes.width);
                }
                if (symbolAttributes.height !== void 0) {
                    height = parseFloat(symbolAttributes.height);
                }
                if (symbolAttributes.viewBox !== void 0) {
                    let list = symbolAttributes.viewBox.split(' ');
                    if (list.length === 4) {
                        list = list.map(item => parseFloat(item));
                        left = list[0];
                        top = list[1];
                        width = list[2];
                        height = list[3];
                    }
                }
                if (!width || !height) {
                    if (options.debug) {
                        options.log('Invalid dimensions for symbol ' + id);
                    }
                    return;
                }
                // Generate SVG
                let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="' + left + ' ' + top + ' ' + width + ' ' + height + '">' + $symbol.html() + '</svg>';

                // Get keyword
                let keyword = options.keywordCallback(id);
                if (keyword === false || keyword === '') {
                    return;
                }

                // Check for duplicate keyword
                if (collection.items[keyword] !== void 0) {
                    options.log('Duplicate entry for ' + keyword);
                    return;
                }

                try {
                    let content = new SVG(svg);
                    collection.add(keyword, content);
                } catch (err) {
                }
            });

            // Done
            if (!collection.length()) {
                reject('No images found.');
            } else {
                fulfill(collection);
            }
        }).catch(err => {
            reject(err);
        });
    });
};