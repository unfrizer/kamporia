import assert from 'node:assert/strict';
const base=process.env.ATLAS_BASE_URL||'http://127.0.0.1:4173';
const passwords={'student.1':process.env.ATLAS_STUDENT_1_PASSWORD,'student.2':process.env.ATLAS_STUDENT_2_PASSWORD,teacher:process.env.ATLAS_TEACHER_PASSWORD,admin:process.env.ATLAS_ADMIN_PASSWORD};
for(const [user,password] of Object.entries(passwords))assert.ok(password,'Missing password for '+user);
async function call(path,{method='GET',body,cookie}={}){
  const response=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json',origin:base}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const sessions={};
for(const [login,password] of Object.entries(passwords)){const result=await call('/api/login',{method:'POST',body:{login,password}});assert.equal(result.status,200,login);sessions[login]=result.cookie;}
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const body={groupId:'g1',subject:'Проектирование интерфейсов',date,dueDate:date,title:'Проверка домашнего задания',body:'Подготовьте три состояния компонента.'};
const regular=await call('/api/homework?from='+date+'&to='+date,{cookie:sessions['student.2']});
assert.equal(regular.status,200);assert.equal(regular.data.canCreate,false);
assert.equal((await call('/api/homework',{method:'POST',cookie:sessions['student.2'],body})).status,403);
assert.equal((await call('/api/homework',{method:'POST',cookie:sessions['student.1'],body:{...body,groupId:'g2'}})).status,403);
const created=await call('/api/homework',{method:'POST',cookie:sessions['student.1'],body});assert.equal(created.status,201,JSON.stringify(created.data));
const ownTask=created.data.assignment||created.data.homework||created.data;
assert.ok(ownTask.id,'Assignment id missing');
const own=await call('/api/homework?from='+date+'&to='+date,{cookie:sessions['student.1']});
assert.ok(own.data.assignments.some(item=>item.id===ownTask.id&&item.canEdit));
const other=await call('/api/homework?from='+date+'&to='+date,{cookie:sessions['student.2']});
assert.ok(!other.data.assignments.some(item=>item.id===ownTask.id));
assert.equal((await call('/api/homework/'+ownTask.id,{method:'PATCH',cookie:sessions.teacher,body:{...body,title:'Forbidden edit'}})).status,403);
assert.equal((await call('/api/homework',{method:'POST',cookie:sessions.teacher,body:{...body,subject:'Аналитика данных'}})).status,403);
const teacherTask=await call('/api/homework',{method:'POST',cookie:sessions.teacher,body:{...body,title:'Задание преподавателя'}});assert.equal(teacherTask.status,201,JSON.stringify(teacherTask.data));
const teacherTaskId=(teacherTask.data.assignment||teacherTask.data.homework||teacherTask.data).id;
assert.equal((await call('/api/homework/'+teacherTaskId,{method:'PATCH',cookie:sessions['student.1'],body})).status,403);
assert.equal((await call('/api/homework/'+teacherTaskId,{method:'PATCH',cookie:sessions.admin,body:{...body,title:'Уточнённое задание'}})).status,200);
for(const login of ['student.1','student.2']){
  const services=await call('/api/student-services',{cookie:sessions[login]});assert.equal(services.status,200);assert.ok(services.data.leadership.length,'No group leadership');
  const resources=await call('/api/resources',{cookie:sessions[login]});assert.equal(resources.status,200);assert.ok(resources.data.subjects.length>=4);assert.ok(resources.data.subjects.every(item=>item.resources.length>0));
}
const profile=await call('/api/people/u2',{cookie:sessions['student.1']});assert.equal(profile.status,200);
for(const key of ['login','password_hash','password_salt','grades','requests'])assert.ok(!(key in profile.data.profile),'Public card exposes '+key);
const allTeachers=await call('/api/schedule',{cookie:sessions['student.1']});
const irina=allTeachers.data.teachers.find(item=>item.name==='Ирина Соколова');assert.ok(irina,'Teacher list incomplete');
const teacherSchedule=await call('/api/schedule?teacherId='+encodeURIComponent(irina.id),{cookie:sessions['student.1']});assert.equal(teacherSchedule.status,200);assert.ok(teacherSchedule.data.lessons.length);assert.ok(teacherSchedule.data.lessons.every(item=>item.teacher==='Ирина Соколова'));
const person=await call('/api/people/'+encodeURIComponent(irina.id),{cookie:sessions['student.1']});assert.equal(person.status,200);assert.ok(person.data.scheduleTeacherId);
const lesson={groupId:'g1',weekday:0,startTime:'22:00',endTime:'22:30',subject:'Тестовый семинар',type:'Семинар',room:'Тестовый корпус · 999',teacherId:'t1',teacher:'Елена Белова',changed:false,changeNote:''};
const scheduleCreated=await call('/api/schedule',{method:'POST',cookie:sessions.admin,body:lesson});assert.equal(scheduleCreated.status,201,JSON.stringify(scheduleCreated.data));
const lessonId=scheduleCreated.data.lesson.id;
assert.equal((await call('/api/schedule',{method:'POST',cookie:sessions.admin,body:{...lesson,startTime:'22:10',endTime:'22:40'}})).status,409);
assert.equal((await call('/api/schedule/'+lessonId,{method:'DELETE',cookie:sessions['student.1']})).status,403);
assert.equal((await call('/api/schedule/'+lessonId,{method:'DELETE',cookie:sessions.admin})).status,200);
for(const id of [ownTask.id,teacherTaskId])assert.equal((await call('/api/homework/'+id,{method:'DELETE',cookie:sessions.admin})).status,200);
console.log('PASS: homework roles/isolation, public profile fields, all teachers, subject library, student support, timetable conflict and delete');
