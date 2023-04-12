#!/usr/bin/python

import sys,os,re,csv,functools,json
#,pyExcelerator

class ZoteroLocaleMerge:
    '''Merge engine for Zotero locale files
       Provides several services useful to locale maintenance, including:

       Populate
           Copy strings from the base en-US files to other supported locales,
           and globally delete strings not present in en-US.

       Merge
           Overwrite locale strings from the content of updated locale
           files supplied by contributors.

       Export
           Write key/string data for selected locales in CSV files, with
           English strings in a third column for ease of reference.

       Import 
           Read updated CSV files, and merge into distribution source.
    '''
    def __init__(self):
        self.files = ['about.dtd','preferences.dtd','searchbox.dtd','standalone.dtd','zotero.dtd', 'csledit.dtd', 'cslpreview.dtd', './mozilla/browser.dtd', './mozilla/editMenuOverlay.dtd', '../scaffold/scaffold.dtd', 'zotero.properties', 'timeline.properties', './mozilla/intl.properties', '../scaffold/scaffold.properties', 'connector.json']
        self.files_csv = ['about-dtd.csv','preferences-dtd.csv','searchbox-dtd.csv','standalone-dtd.csv','timeline-properties.csv','zotero-dtd.csv', 'zotero-properties.csv', 'csledit-dtd.csv', 'cslpreview-dtd.csv', 'browser-dtd.csv', 'editMenuOverlay-dtd.csv', 'intl-properties.csv', 'scaffold-dtd.csv', 'scaffold-properties.csv']
        self.establishBasePaths()
        #self.masterData = {}
        self.referenceData = {}
        self.masterData = {}
        self.dtdKeys = {}
        for filename in self.files:
            # For use in writing to other locales (overwritten during processing)
            self.masterData[filename] = self.extract('en-US', filename)
            if os.path.exists(os.path.join('locale-rev/en-US/zotero',filename)):
                self.masterData[filename].update(self.extract('en-US', filename, template='locale-rev/%s/zotero/%s'))
            self.output('en-US', filename, self.masterData[filename])
            # For use in outputting strings to CSV (not overwritten)
            self.referenceData[filename] = {}
            self.referenceData[filename].update(self.masterData[filename])

    def merge(self):
        '''Merge data
           Master method to perform Populate, Merge, Export and Import operations
           across all locales.

           User updates in the form of locale files should be
           placed below a subdirectory ``locale-rev``, in directories
           corresponding to the name of the target locale. Update
           files may be deleted after merging.

           User updates in the form of (revised) exported CSV
           files should be placed below a subdirectory ``locale-csv-in``,
           in directories corresponding to the name of the target
           locale. Update files may be deleted after merging.

           After every merge, updated CSV files for all locales
           is available for circulation under ``locale-csv-out``.
        '''
        for locale in os.listdir('chrome/locale'):
            if locale == '.git' or locale == '.svn' or locale == 'en-US':
                continue
            print ("Normalizing locale files for: %s" % locale)
            for filename in self.files:
                data = self.processFile(locale, filename)
                self.output(locale, filename, data)
        for locale in os.listdir('chrome/locale'):
            if locale == '.git' or locale == '.svn':
                continue

            #self.wb = pyExcelerator.Workbook()
			#
            #self.masterData = {}
            #for filename in self.files:
            #    # Extract from existing locale
            #    self.masterData[filename] = self.extract(locale, filename, template='chrome/locale/%s/zotero/%s')
            #    # Overwrite anything contained in update files
            #    self.masterData[filename].update(self.extract(locale, filename, template='locale-rev/%s/zotero/%s', cautious=True))
            #    self.masterData[filename].update(self.extract_csv(locale, filename))
            #    self.masterData[filename].update(self.extract_xls(locale, filename))
            #    data = self.processFile(locale, filename, force=True)
            #    self.output(locale, filename, data, export=True)
            #self.wb.save('locale-xls-out/%s.xls' % locale)

    def processFile(self, locale, filename, force=False):
        data = self.extract(locale, filename)
        data = self.mergeData(filename, data, force=force)
        return data

    def mergeData(self, filename, data, force=False):
        for key in self.masterData[filename].keys():
            # With force, always overwrite target with master data,
            # but only if a partner exists (extensions to the
            # key set should first be made to the en-US locale)
            if force and key in data:
                data[key] = self.masterData[filename][key]
            if not force and not key in data:
                print ("   Adding in %s: %s" % (filename, key))
                data[key] = self.masterData[filename][key]
        if not force:
            # With force, do not delete strings that happen to be missing from
            # the update master
            pops = [];
            for key in data:
                if not key in self.masterData[filename]:
                    pops.append(key)
            for key in pops:
                print ('Popping? %s' % key)
                data.pop(key)
        return data

    def extract_csv(self, locale, filename):
        template_in = 'locale-csv-in/%s/%s'
        filename_csv = self.csvName(filename)
        if not os.path.exists(template_in % (locale, filename_csv)):
            return {}
        ifh = open(template_in % (locale, filename_csv))
        cread = csv.reader(ifh)
        ret = {}
        for row in cread:
            ret[row[0]] = row[1]
        ifh.close()
        return ret


#    def extract_xls(self, locale, filename):
#        path_xls = 'locale-xls-in/%s.xls' % locale
#        if not os.path.exists(path_xls):
#            return {}
#        ifh = open(path_xls)
#        content = pyExcelerator.parse_xls(ifh)
#        ret = {}
#        rownum = 0
#        sheetnum = self.files.index(filename)
#        while True:
#            #print 'ok1'
#            if (content[sheetnum][1].has_key((rownum, 0))):
#                #print ' ok2'
#                if (content[sheetnum][1].has_key((rownum, 1))):
#                    #print '  ok3'
#                    ret[content[sheetnum][1][(rownum, 0)]] = content[sheetnum][1][(rownum, 1)]
#            else:
#                break
#            rownum += 1
#        ifh.close()
#        return ret


    def extract(self, locale, filename, template='chrome/locale/%s/zotero/%s', cautious=False):
        if not os.path.exists(template % (locale, filename)):
            return {}

        ifh = open(template % (locale, filename))
        
        if filename.endswith('.dtd'):
            # Wildcard at start of expression to avoid a UTF8 BOM at top of file
            rex = '.*?<!\s*ENTITY\s*(.*?)\s+\"([^\"]*)\"\s*>'
        elif filename.endswith('.json'):
            rex = False
        else:
            rex = '(.*?)\s*=\s*(.*)\s*'

        data = {}
        if rex:
            while 1:
                line = ifh.readline()
                if not line: break
                if line.strip():
                    m = re.match(rex, line)
                    if (m):
                        if cautious and m.group(2).lower().find("create a new item") > -1:
                            print ("SKIPPING: %s" % m.group(2))
                            continue
                        if cautious and m.group(2).lower().find("create a new note") > -1:
                            print ("SKIPPING: %s" % m.group(2))
                            continue
                        # For DOS line endings that can creep into the source.
                        data[m.group(1)] = m.group(2).strip('\x0d')
                        if filename.endswith('.dtd'):
                            self.dtdKeys[m.group(1)] = True
        else:
            data = json.loads(ifh.read())
                
        ifh.close()
        return data

    def output(self, locale, filename, data, export=False):

        if filename.endswith('.json') and not os.path.exists('chrome/locale/%s/zotero/%s' % (locale, filename)):
            return
        filepath = 'chrome/locale/%s/zotero/%s' % (locale, filename)
        ofh = open(filepath, 'w+')

        if export:
            if not os.path.exists('locale-csv-out/%s' % locale):
                os.makedirs('locale-csv-out/%s' % locale)

            filename_csv = self.csvName(filename)
            ofhCSV = open('locale-csv-out/%s/%s' % (locale, filename_csv), 'w+')
            csvwrite = csv.writer(ofhCSV)

            ws = self.wb.add_sheet(filename)

        if filename.endswith('.json'):
            ofh.write(json.dumps(data, sort_keys=True, indent=2, ensure_ascii=False))
        else:
            lst = []
            for key in data:
                lst.append([key, data[key]])
            #lst.sort(self.sortKeys)
            #lst.sort()
            rows = []
            rownum = 0
            for item in sorted(lst, key=functools.cmp_to_key(self.sortKeys)):
                if filename.endswith('.dtd'):
                    ofh.write('<!ENTITY %s \"%s\">\n' % (item[0], item[1]))
                else:
                    if item[0] in self.dtdKeys:
                        print("Skipping duplicate in %s (%s)" % (filepath, item[0]))
                        continue
                    ofh.write('%s	= %s\n' % (item[0], item[1]))
    
                if export:
                    item.append(self.referenceData[filename][item[0]])
                    rows.append(item)
    
                    ws.write(rownum, 0, item[0].decode('utf8'))
                    ws.write(rownum, 1, item[1].decode('utf8'))
                    ws.write(rownum, 2, self.referenceData[filename][item[0]].decode('utf8'))
                    rownum += 1
        ofh.close()

        if export:
            csvwrite.writerows(rows)
            ofhCSV.close()

    def sortKeys(self, a, b):
        if a[0] > b[0]:
            return 1
        elif a[0] < b[0]:
            return -1
        else:
            return 0

    def csvName(self, filename):
        filename = filename.replace('.properties', '-properties.csv')
        filename = filename.replace('.dtd', '-dtd.csv')
        return filename

    def establishBasePaths(self):
        if not os.path.exists('resource/schema/userdata.sql') or not os.path.exists('chrome'):
            print ("Oops. I'm not in a Zotero source archive?")
            sys.exit()
        for p in ['locale-rev','locale-csv-in','locale-csv-out','locale-xls-out']:
            if not os.path.exists(p):
                os.makedirs(p)


if __name__ == "__main__":

    print ("Updating locales from en-US master ...")
    merger = ZoteroLocaleMerge();
    merger.merge()
    print ("  done")
