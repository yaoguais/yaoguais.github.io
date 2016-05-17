## Supervisor安装使用

目录:

1. 安装
2. 配置
3. 注意事项



### 安装

supervisor是python写的程序,那么首先得安装python,但是unix系统都是自带python的,所以这步略过.

python安装软件包可以使用easy_install脚本,[官方网站在这里](https://pypi.python.org/pypi/setuptools),
我们选择unix系统的.

    wget https://bootstrap.pypa.io/ez_setup.py -O - | python

然后安装supervisor,我们参见其[官网](http://supervisord.org/).

    easy_install supervisor

然后生成其默认的配置文件

    echo_supervisord_conf > /etc/supervisord.conf

输入echo_supervisord_conf可以查看其默认配置:

    ; Sample supervisor config file.
    ;
    ; For more information on the config file, please see:
    ; http://supervisord.org/configuration.html
    ;
    ; Notes:
    ;  - Shell expansion ("~" or "$HOME") is not supported.  Environment
    ;    variables can be expanded using this syntax: "%(ENV_HOME)s".
    ;  - Comments must have a leading space: "a=b ;comment" not "a=b;comment".

    [unix_http_server]
    file=/tmp/supervisor.sock   ; (the path to the socket file)
    ;chmod=0700                 ; socket file mode (default 0700)
    ;chown=nobody:nogroup       ; socket file uid:gid owner
    ;username=user              ; (default is no username (open server))
    ;password=123               ; (default is no password (open server))

    ;[inet_http_server]         ; inet (TCP) server disabled by default
    ;port=127.0.0.1:9001        ; (ip_address:port specifier, *:port for all iface)
    ;username=user              ; (default is no username (open server))
    ;password=123               ; (default is no password (open server))

    [supervisord]
    logfile=/tmp/supervisord.log ; (main log file;default $CWD/supervisord.log)
    logfile_maxbytes=50MB        ; (max main logfile bytes b4 rotation;default 50MB)
    logfile_backups=10           ; (num of main logfile rotation backups;default 10)
    loglevel=info                ; (log level;default info; others: debug,warn,trace)
    pidfile=/tmp/supervisord.pid ; (supervisord pidfile;default supervisord.pid)
    nodaemon=false               ; (start in foreground if true;default false)
    minfds=1024                  ; (min. avail startup file descriptors;default 1024)
    minprocs=200                 ; (min. avail process descriptors;default 200)
    ;umask=022                   ; (process file creation umask;default 022)
    ;user=chrism                 ; (default is current user, required if root)
    ;identifier=supervisor       ; (supervisord identifier, default is 'supervisor')
    ;directory=/tmp              ; (default is not to cd during start)
    ;nocleanup=true              ; (don't clean up tempfiles at start;default false)
    ;childlogdir=/tmp            ; ('AUTO' child log dir, default $TEMP)
    ;environment=KEY="value"     ; (key value pairs to add to environment)
    ;strip_ansi=false            ; (strip ansi escape codes in logs; def. false)

    ; the below section must remain in the config file for RPC
    ; (supervisorctl/web interface) to work, additional interfaces may be
    ; added by defining them in separate rpcinterface: sections
    [rpcinterface:supervisor]
    supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

    [supervisorctl]
    serverurl=unix:///tmp/supervisor.sock ; use a unix:// URL  for a unix socket
    ;serverurl=http://127.0.0.1:9001 ; use an http:// url to specify an inet socket
    ;username=chris              ; should be same as http_username if set
    ;password=123                ; should be same as http_password if set
    ;prompt=mysupervisor         ; cmd line prompt (default "supervisor")
    ;history_file=~/.sc_history  ; use readline history if available

    ; The below sample program section shows all possible program subsection values,
    ; create one or more 'real' program: sections to be able to control them under
    ; supervisor.

    ;[program:theprogramname]
    ;command=/bin/cat              ; the program (relative uses PATH, can take args)
    ;process_name=%(program_name)s ; process_name expr (default %(program_name)s)
    ;numprocs=1                    ; number of processes copies to start (def 1)
    ;directory=/tmp                ; directory to cwd to before exec (def no cwd)
    ;umask=022                     ; umask for process (default None)
    ;priority=999                  ; the relative start priority (default 999)
    ;autostart=true                ; start at supervisord start (default: true)
    ;startsecs=1                   ; # of secs prog must stay up to be running (def. 1)
    ;startretries=3                ; max # of serial start failures when starting (default 3)
    ;autorestart=unexpected        ; when to restart if exited after running (def: unexpected)
    ;exitcodes=0,2                 ; 'expected' exit codes used with autorestart (default 0,2)
    ;stopsignal=QUIT               ; signal used to kill process (default TERM)
    ;stopwaitsecs=10               ; max num secs to wait b4 SIGKILL (default 10)
    ;stopasgroup=false             ; send stop signal to the UNIX process group (default false)
    ;killasgroup=false             ; SIGKILL the UNIX process group (def false)
    ;user=chrism                   ; setuid to this UNIX account to run the program
    ;redirect_stderr=true          ; redirect proc stderr to stdout (default false)
    ;stdout_logfile=/a/path        ; stdout log path, NONE for none; default AUTO
    ;stdout_logfile_maxbytes=1MB   ; max # logfile bytes b4 rotation (default 50MB)
    ;stdout_logfile_backups=10     ; # of stdout logfile backups (default 10)
    ;stdout_capture_maxbytes=1MB   ; number of bytes in 'capturemode' (default 0)
    ;stdout_events_enabled=false   ; emit events on stdout writes (default false)
    ;stderr_logfile=/a/path        ; stderr log path, NONE for none; default AUTO
    ;stderr_logfile_maxbytes=1MB   ; max # logfile bytes b4 rotation (default 50MB)
    ;stderr_logfile_backups=10     ; # of stderr logfile backups (default 10)
    ;stderr_capture_maxbytes=1MB   ; number of bytes in 'capturemode' (default 0)
    ;stderr_events_enabled=false   ; emit events on stderr writes (default false)
    ;environment=A="1",B="2"       ; process environment additions (def no adds)
    ;serverurl=AUTO                ; override serverurl computation (childutils)

    ; The below sample eventlistener section shows all possible
    ; eventlistener subsection values, create one or more 'real'
    ; eventlistener: sections to be able to handle event notifications
    ; sent by supervisor.

    ;[eventlistener:theeventlistenername]
    ;command=/bin/eventlistener    ; the program (relative uses PATH, can take args)
    ;process_name=%(program_name)s ; process_name expr (default %(program_name)s)
    ;numprocs=1                    ; number of processes copies to start (def 1)
    ;events=EVENT                  ; event notif. types to subscribe to (req'd)
    ;buffer_size=10                ; event buffer queue size (default 10)
    ;directory=/tmp                ; directory to cwd to before exec (def no cwd)
    ;umask=022                     ; umask for process (default None)
    ;priority=-1                   ; the relative start priority (default -1)
    ;autostart=true                ; start at supervisord start (default: true)
    ;startsecs=1                   ; # of secs prog must stay up to be running (def. 1)
    ;startretries=3                ; max # of serial start failures when starting (default 3)
    ;autorestart=unexpected        ; autorestart if exited after running (def: unexpected)
    ;exitcodes=0,2                 ; 'expected' exit codes used with autorestart (default 0,2)
    ;stopsignal=QUIT               ; signal used to kill process (default TERM)
    ;stopwaitsecs=10               ; max num secs to wait b4 SIGKILL (default 10)
    ;stopasgroup=false             ; send stop signal to the UNIX process group (default false)
    ;killasgroup=false             ; SIGKILL the UNIX process group (def false)
    ;user=chrism                   ; setuid to this UNIX account to run the program
    ;redirect_stderr=false         ; redirect_stderr=true is not allowed for eventlisteners
    ;stdout_logfile=/a/path        ; stdout log path, NONE for none; default AUTO
    ;stdout_logfile_maxbytes=1MB   ; max # logfile bytes b4 rotation (default 50MB)
    ;stdout_logfile_backups=10     ; # of stdout logfile backups (default 10)
    ;stdout_events_enabled=false   ; emit events on stdout writes (default false)
    ;stderr_logfile=/a/path        ; stderr log path, NONE for none; default AUTO
    ;stderr_logfile_maxbytes=1MB   ; max # logfile bytes b4 rotation (default 50MB)
    ;stderr_logfile_backups=10     ; # of stderr logfile backups (default 10)
    ;stderr_events_enabled=false   ; emit events on stderr writes (default false)
    ;environment=A="1",B="2"       ; process environment additions
    ;serverurl=AUTO                ; override serverurl computation (childutils)

    ; The below sample group section shows all possible group values,
    ; create one or more 'real' group: sections to create "heterogeneous"
    ; process groups.

    ;[group:thegroupname]
    ;programs=progname1,progname2  ; each refers to 'x' in [program:x] definitions
    ;priority=999                  ; the relative start priority (default 999)

    ; The [include] section can just contain the "files" setting.  This
    ; setting can list multiple files (separated by whitespace or
    ; newlines).  It can also contain wildcards.  The filenames are
    ; interpreted as relative to this file.  Included files *cannot*
    ; include files themselves.

    ;[include]
    ;files = relative/directory/*.ini





## 配置

我们修改其配置文件中的program字段:

    [program:ls]
    command=/bin/ls /
    stdout_logfile=/var/log/supervisor_ls.log
    autostart=true

然后启动supervisor守护进程

    supervisord -c /etc/supervisord.conf

使用supervisorctl操作我们配置的程序

    # supervisorctl
    ls                               BACKOFF   Exited too quickly (process log may have details)
    supervisor> exit

然后我们查看日志文件

    vim /var/log/supervisor_ls.log

我们看一下supervisorctl的详细使用方式

    [root@dev ~]# supervisorctl
    ls                               FATAL     Exited too quickly (process log may have details)
    supervisor> help

    default commands (type help <topic>):
    =====================================
    add    exit      open  reload  restart   start   tail
    avail  fg        pid   remove  shutdown  status  update
    clear  maintail  quit  reread  signal    stop    version

    supervisor> help start
    start <name>		Start a process
    start <gname>:*		Start all processes in a group
    start <name> <name>	Start multiple processes or groups
    start all		Start all processes
    supervisor>

然后我们再查看supervisord的日志文件

    vim /tmp/supervisord.log

至此,supervisor的安装配置已经完毕.更多细节请参考其[官方网站](http://supervisord.org/).





### 注意事项

上面我们的测试程序使用的ls,但是实际场景中我们使用supervisor都是保证我们的进程能够在内存中常驻,并且发生崩溃也能自动重启.


#### 进程关系


那么在配置supervisor的时候,我们需要注意很多细节,这是由于我们的进程是被supervisord创建出来的子进程.

我们可以通过pstree命令查看这种关系.

    pstree -up


#### 文件描述符

由于我们的进程是supervisor的子进程,那么如果我们要修改一个程序的最大文件描述符,
首先我们需要通过ulimit修改系统的配置,然后修改supervisord.conf中的minfd配置项.

