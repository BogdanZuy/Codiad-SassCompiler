/*
 * Copyright (c) Codiad & Andr3as, distributed
 * as-is and without warranty under the MIT License.
 * See http://opensource.org/licenses/MIT for more information. 
 * This information must remain intact.
 */

(function(global, $){
    
    var codiad = global.codiad,
        scripts = document.getElementsByTagName('script'),
        path = scripts[scripts.length-1].src.split('?')[0],
        curpath = path.split('/').slice(0, -1).join('/')+'/';

    $(function() {
        codiad.Sass.init();
    });

    codiad.Sass = {
        
        path: curpath,
        base: "",
        sass: null, //Sass instance
        tree: [],
        
        init: function() {
            var _this = this;
            
            $.getScript(this.path + "sass/sass.js", function(){
                Sass.setWorkerUrl(_this.path + 'sass/sass.worker.js');
                _this.sass = new Sass();
                _this.sass.importer(_this.importer.bind(_this));
            });

            // icons <
            $('.sb-right-content hr:first').before('<div class="icon_bar"><hr class="file-only sass"><a class="file-only sass"><span class="icon-code"></span>Compile Sass</a></div>');
            // $('.icon_bar').html(
            //     '<div class="line"><span class="icon icon-ccw disabled" title="Undo"/>'+
            //     '</div>');

            amplify.subscribe('active.onFocus', function(path){
                _this.activateIcons(path);
            });
            amplify.subscribe('active.onClose', function(path){
                _this.deactivateIcons(path);
            });
            $('.icon_bar .sass:not(.disabled)').live('click',function(event){
                var item = event.target;
                codiad.Sass.contextMenu(codiad.active.getPath());
            });
             this.$onDocumentChange = this.onDocumentChange.bind(this);
             amplify.subscribe('active.onOpen', function(path){
                 var session = codiad.editor.getActive().getSession();
                 if (/(\.sass|\.scss)$/.test(codiad.active.getPath())) {
                     _this.deactivateIcons(path);
                 }
                 
                 session.addEventListener('change', _this.$onDocumentChange);
             });
            
            // icons >
            
            amplify.subscribe('context-menu.onShow', function(obj){
                if (/(\.sass|\.scss)$/.test(obj.path)) {
                    $('#context-menu').append('<hr class="file-only sass">');
                    $('#context-menu').append('<a class="file-only sass" onclick="codiad.Sass.contextMenu($(\'#context-menu\').attr(\'data-path\'));"><span class="icon-code"></span>Compile Sass</a>');
                }
            });
            amplify.subscribe('context-menu.onHide', function(){
                $('.sass').remove();
            });
        },
        
        // icons <
        activateIcons: function(path) {
            $('.icon_bar .sass').removeClass('disabled');
            this.onDocumentChange();
        },
        
        deactivateIcons: function(path) {
            $('.icon_bar .sass').addClass('disabled');
        },
        
        onDocumentChange: function() {
            $('.icon_bar .sass').removeClass('disabled');
        },
        // icons >
        
        compile: function(scss, callback) {
            var _this = this;
            setTimeout(function(){
                _this.setSettings();
                _this.sass.compile(scss, function(result) {
                    callback(result);
                });
            }, 0);
        },
        
        contextMenu: function(path) {
            this.processFile(path);
        },
        
        getIndentation: function() {
            if (codiad.editor.settings.softTabs) {
                var length = parseInt(codiad.editor.settings.tabSize, 10);
                var indent = "";
                for (var i = 0; i < length; i++) {
                    indent += " ";
                }
                return indent;
            } else {
                return "\t";
            }
        },
        
        getMatchingFileOutOfTree: function(path) {
            var dir = this.__dirname(path);
            var basename = this.__basename(path);
            
            if (dir == path) {
                dir = "";
            } else {
                dir += "/";
            }
            
            var cases = ["_" + basename + ".scss", "_" + basename + ".sass",
                        basename + ".scss", basename + ".sass",
                        "_" + basename + ".css", basename + ".css"];
            for (var j = 0; j < this.tree.length; j++) {
                for (var i = 0; i < cases.length; i++) {
                    if (this.tree[j] === (dir + cases[i])) {
                        return this.tree[j];
                    }
                }
            }
            return false;
        },
        
        importer: function(request, done) {
            var path = this.getMatchingFileOutOfTree(request.current);
            
            if (path === false) {
                var result = {};
                result.error = "File not found";
                done(result);
                return;
            } else {
                path = this.base + "/" + path;
            }
            
            //var path = this.base + "/" + request.current;
            $.getJSON(this.path + 'controller.php?action=getContent&path=' + path, function(response){
                var result = {};
                if (response.status == "success") {
                    result.content = response.content;
                } else {
                    result.error = response.message;
                }
                done(result);
            });
        },
        
        processFile: function(path) {
            var _this = this;
            this.base = this.__dirname(path);
            $.getJSON(this.path + 'controller.php?action=getContent&path=' + path, function(json){
                if (json.status == "success") {
                    $.getJSON(_this.path + 'controller.php?action=getFileTree&path=' + path, function(tree){
                        _this.tree = tree.tree;
                        _this.compile(json.content, function(result){
                            //Catch errors
                            if (result.status === 0) {
                                $.post(_this.path + 'controller.php?action=saveContent&path=' + path, {content: result.text}, function(response){
                                    response = JSON.parse(response);
                                    if (response.status == "success") {
                                        codiad.filemanager.rescan($('#project-root').attr('data-path'));
                                    }
                                    codiad.message[response.status](response.message);
                                });
                            } else {
                                codiad.message.error(result.message + " on Line " + result.line + " Column " + result.column);
                            }
                        });
                    });
                } else {
                    codiad.message.error(json.message);
                }
            });
        },
        
        setSettings: function() {
            var _this = this;
            this.sass.options({
                style: Sass.style.expanded,
                indent: _this.getIndentation()
            }, function(){});
        },
        
        __basename: function(path, suffix) {
            //  discuss at: http://phpjs.org/functions/basename/
            var b = path;
            var lastChar = b.charAt(b.length - 1);
            
            if (lastChar === '/' || lastChar === '\\') {
                b = b.slice(0, -1);
            }
            
            b = b.replace(/^.*[\/\\]/g, '');
            
            if (typeof suffix === 'string' && b.substr(b.length - suffix.length) == suffix) {
                b = b.substr(0, b.length - suffix.length);
            }
            
            return b;
        },
        
        __dirname: function(path) {
            // discuss at: http://phpjs.org/functions/dirname/
            return path.replace(/\\/g, '/')
                        .replace(/\/[^\/]*\/?$/, '');
        }

    };
})(this, jQuery);
