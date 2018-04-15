'use strict';
//global & node variables
const fs = require('fs');
const request = require('request');
const moment = require('moment'); //human readable time stamps
const cheerio = require('cheerio'); //scrapes content AND allows jQuery syntax, nifty
const json2csv = require('json2csv'); //had to use an older version, newer versions didn't work the way I wanted them to, but does compile to csv
const url = 'http://shirts4mike.com';
const csvHeaders = ['Title', 'Price', 'ImageURL', 'URL', 'Time'];
let totalShirts = new Array();
let linksOnPage = [];
let scrapableShirts = [];
//error handling function
const errorHandler = function(error) {
    if (error) {
        let errorDate = new Date();
        let errorLog = '[' + errorDate + '] There was an error! ' + error.code + ' ' + error.message + '\r\n';
        console.error(errorLog);
        //log error to file
        fs.appendFile('./data/scrape-error.log', errorLog, function(error) {
            if (error) throw error;
        });
    }
};
//request function
request(url, function(error, response, html) {
    if (!error && response.statusCode == 200) {
    //cheerio jQuery syntax
        let $ = cheerio.load(html);
        //find all URLs with "shirt"
        $('a[href*=\'shirt\']').each( function() {
            let href = $(this).attr('href');
            let fullPath = url + '/' + href;
            if (linksOnPage.indexOf(fullPath) === -1) {
                //add the full path of all links found on the homepage
                linksOnPage.push(fullPath);}
        });
        for (let i = 0; i < linksOnPage.length; i++) {
        //loop over links, if not a product page, scrap
            if (linksOnPage[i].indexOf('?id=') > 0 ) {
                //otherwise add to the shirts array
                scrapableShirts.push(linksOnPage[i]);
            } else {
                request(linksOnPage[i], function(error, response, html) {
                    //scrape the links seen again if product pages
                    if (!error && response.statusCode == 200) {
                        //push to final shirts array
                        let $ = cheerio.load(html);
                        $('a[href*=\'shirt.php?id=\']').each( function() {
                            let href = $(this).attr('href');
                            let fullPath = url + '/' + href;
                            if (scrapableShirts.indexOf(fullPath) === -1) {
                                scrapableShirts.push(fullPath);}
                        });
                        //loop over array of shirts
                        for (let s = 0; s < scrapableShirts.length; s++) {
                            request(scrapableShirts[s], function(error, response, html) { // Scrape the final shirts array
                                if (!error && response.statusCode == 200) {
                                    let $ = cheerio.load(html);
                                    let title = $('title').text();
                                    let price = $('.price').text();
                                    let img = $('.shirt-picture img').attr('src');
                                    let shirts = {};
                                    shirts.Title = title;
                                    shirts.Price = price;
                                    shirts.ImageURL = url + img;
                                    shirts.URL = response.request.uri.href;
                                    shirts.Time = moment().format('MMMM Do YYYY, h:mm:ss a');
                                    totalShirts.push(shirts);
                                    //if all shirts have been grabbed, grab date time
                                    let time = moment().format('YYYY[-]MM[-]DD');
                                    let dir = './data'; //create the data directory; if directory does not exist, create it
                                    if(!fs.existsSync(dir)) {
                                        fs.mkdirSync(dir);
                                    }
                                    if(fs.existsSync('./data/scrape-error.log')) {
                                        fs.unlink('./data/scrape-error.log', function(error) {
                                            if (error) throw error;
                                        });
                                    }
                                    json2csv({ data: totalShirts, fields: csvHeaders }, function(error, csv) {
                                        fs.writeFile( dir + '/' + time + '.csv', csv, function(error) {
                                            if (error) throw error;
                                        });
                                    });
                                } else {
                                    errorHandler(error);
                                }
                            });
                        }
                    } else {
                        errorHandler(error);
                    }
                });
            }
        }
    } else {
        errorHandler(error);
    }
});
