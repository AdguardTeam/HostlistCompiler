const { FiltersDownloader } = require('@adguard/filters-downloader');
const { stripErrorCredentials } = require('./utils');

/**
 * Downloads the specified source (a URL or a local file path) and
 * resolves all `!#include` directives in it.
 *
 * @param {String} source - URL or local file path of the source.
 * @returns {Promise<Array<String>>} array with the source rules.
 */
async function download(source) {
    try {
        return await FiltersDownloader.download(source, {}, { allowEmptyResponse: true });
    } catch (error) {
        // The downloader gets the original URL so it can send Basic auth, but
        // its errors may contain that URL. Sanitize the whole chain before the
        // error leaves the download layer.
        throw stripErrorCredentials(error);
    }
}

module.exports = {
    download,
};
