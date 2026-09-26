import { beforeEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({row:{id:'actor',updated_at:'v1',must_change_password:false,password_operation_id:null as string|null}}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from:()=>({update:(changes:Record<string,unknown>)=>{
 const predicates:((row:typeof state.row)=>boolean)[]=[];
 const query={eq:(key:string,value:unknown)=>{predicates.push(row=>row[key as keyof typeof row]===value);return query;},is:(key:string,value:unknown)=>{predicates.push(row=>row[key as keyof typeof row]===value);return query;},select:()=>query,maybeSingle:async()=>{
  if(!predicates.every(p=>p(state.row)))return {data:null,error:null}; Object.assign(state.row,changes,{updated_at:state.row.updated_at+'x'});return {data:{id:'actor'},error:null};
 }};return query;
}})})}));
import { performPasswordUpdate } from '@/lib/password-operation';
beforeEach(()=>{state.row={id:'actor',updated_at:'v1',must_change_password:false,password_operation_id:null};});
it('serializes reset and change even when change sees the new profile version',async()=>{
 let release!:()=>void;
 const reset=performPasswordUpdate({...state.row},async()=>{await new Promise<void>(r=>{release=r;});return {error:null};},true);
 await vi.waitFor(()=>expect(state.row.password_operation_id).not.toBeNull());
 const changeAuth=vi.fn(async()=>({error:null}));
 const changed=await performPasswordUpdate({...state.row},changeAuth,false);
 expect(changed.ok).toBe(false);expect(changeAuth).not.toHaveBeenCalled();expect(state.row.must_change_password).toBe(true);
 release();expect((await reset).ok).toBe(true);expect(state.row.must_change_password).toBe(true);expect(state.row.password_operation_id).toBeNull();
});
it('clears restriction only after successful private password update',async()=>{
 const result=await performPasswordUpdate({...state.row},async()=>{expect(state.row.must_change_password).toBe(true);return {error:null};},false);
 expect(result.ok).toBe(true);expect(state.row.must_change_password).toBe(false);expect(state.row.password_operation_id).toBeNull();
});
it('releases a failed operation for retry while retaining mandatory password change',async()=>{
 const result=await performPasswordUpdate({...state.row},async()=>({error:new Error('rejected')}),false);
 expect(result.ok).toBe(false);expect(state.row.must_change_password).toBe(true);expect(state.row.password_operation_id).toBeNull();
});
