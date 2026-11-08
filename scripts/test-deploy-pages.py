import os, subprocess, tempfile, pathlib, json
source=pathlib.Path(__file__).resolve().parent.parent/'deploy-pages.sh'
with tempfile.TemporaryDirectory(prefix='deploy-test-',dir=pathlib.Path.cwd()) as tmp:
 p=pathlib.Path(tmp);origin=p/'origin.git';repo=p/'project';repo.mkdir()
 def run(args,cwd=None,env=None,ok=True):
  v=subprocess.run(args,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env)
  if ok and v.returncode:raise RuntimeError('Command failed: '+str(args)+'\n'+v.stdout)
  return v
 run(['git','init','--bare',str(origin)])
 run(['git','init','-b','main'],repo)
 for key,val in [('user.name','Test User'),('user.email','test@example.invalid')]:run(['git','config',key,val],repo)
 (repo/'package.json').write_text(json.dumps({'name':'deployment-test','version':'1.0.0','scripts':{'build':'node build.cjs','verify':'node verify.cjs'}}))
 (repo/'package-lock.json').write_text(json.dumps({'name':'deployment-test','version':'1.0.0','lockfileVersion':3,'requires':True,'packages':{'':{'name':'deployment-test','version':'1.0.0'}}}))
 (repo/'build.cjs').write_text("const fs=require('fs');fs.writeFileSync('generated.txt','build output');fs.mkdirSync('dist/assets',{recursive:true});fs.writeFileSync('dist/index.html',fs.readFileSync('content.txt'));fs.writeFileSync('dist/assets/x.js','export default 1');fs.mkdirSync('.cache',{recursive:true});fs.writeFileSync('.cache/state.json','{}');fs.mkdirSync('data/thumbnails',{recursive:true});fs.writeFileSync('data/thumbnails/x.webp','x');")
 (repo/'verify.cjs').write_text("require('fs').accessSync('dist/index.html');")
 (repo/'content.txt').write_text('version one')
 (repo/'index.html').write_text('<!doctype html><title>test</title>')
 (repo/'generated.txt').write_text('local edits')
 run(['git','add','package.json','package-lock.json','build.cjs','verify.cjs','content.txt','index.html','generated.txt'],repo);run(['git','commit','-m','Initial'],repo);run(['git','remote','add','origin',str(origin)],repo)
 run(['git','push','-u','origin','main'],repo)
 env=os.environ.copy();env['TMPDIR']=tmp
 out=run(['bash',str(source)],repo,env);print('create:',out.stdout.splitlines()[-2:])
 assert (repo/'.cache/state.json').read_text()=='{}','generated cache must be persisted to the source repo'
 assert (repo/'data/thumbnails/x.webp').read_text()=='x','generated previews must be persisted to the source repo'
 first=run(['git','--git-dir',str(origin),'rev-parse','refs/heads/gh-pages']).stdout.strip()
 names=run(['git','--git-dir',str(origin),'ls-tree','-r','--name-only','refs/heads/gh-pages']).stdout.splitlines()
 assert names==['.nojekyll','assets/x.js','index.html'],names
 out=run(['bash',str(source)],repo,env);assert 'Сайт не изменился' in out.stdout
 assert run(['git','--git-dir',str(origin),'rev-parse','refs/heads/gh-pages']).stdout.strip()==first
 other=p/'other';run(['git','clone','--branch','gh-pages',str(origin),str(other)])
 for key,val in [('user.name','Test User'),('user.email','test@example.invalid')]:run(['git','config',key,val],other)
 (other/'CNAME').write_text('atlas.example.org\n');(other/'old-file.txt').write_text('obsolete')
 run(['git','add','CNAME','old-file.txt'],other);run(['git','commit','-m','Domain'],other);run(['git','push'],other)
 (repo/'content.txt').write_text('version two')
 out=run(['bash',str(source)],repo,env);print('update:',out.stdout.splitlines()[-2:])
 names=run(['git','--git-dir',str(origin),'ls-tree','-r','--name-only','refs/heads/gh-pages']).stdout.splitlines()
 assert names==['.nojekyll','CNAME','assets/x.js','index.html'],names
 assert run(['git','--git-dir',str(origin),'show','gh-pages:CNAME']).stdout=='atlas.example.org\n'
 assert run(['git','--git-dir',str(origin),'show','gh-pages:index.html']).stdout=='version two'
 assert (repo/'content.txt').read_text()=='version two'
 assert (repo/'generated.txt').read_text()=='local edits'
 assert run(['git','branch','--show-current'],repo).stdout.strip()=='main'
 assert ' M content.txt' in run(['git','status','--porcelain'],repo).stdout
 env['PAGES_BRANCH']='main';denied=run(['bash',str(source)],repo,env,ok=False);assert denied.returncode!=0
 print('PASS: create, unchanged, update, CNAME, existing files, dirty source, main protection.')
